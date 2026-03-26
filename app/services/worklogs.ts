import {addDays, endOfMonth, endOfWeek, format, isSameDay, startOfMonth, startOfWeek} from 'date-fns';
import {getActiveAuth} from './authentication/auth';
import type {DayWorklog} from '../types/jira';
import {apiFetch} from "@/app/services/api/apiClient";

const formatDate = (date: Date) => format(date, 'yyyy-MM-dd');

export const fetchWorklogs = async (startDate: Date, endDate: Date): Promise<DayWorklog[]> => {
    const startStr = format(startDate, 'yyyy-MM-dd');
    const endStr = format(endDate, 'yyyy-MM-dd');

    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const worklogData: DayWorklog[] = [];
    
    for (let i = 0; i < totalDays; i++) {
        const day = addDays(startDate, i);
        worklogData.push({
            date: formatDate(day),
            tickets: [],
            totalHours: 0
        });
    }

    try {
        const jql = `worklogAuthor = currentUser() AND worklogDate >= "${startStr}" AND worklogDate <= "${endStr}"`;

        const searchRes = await apiFetch(
            `/api/jira/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&fields=summary,project`);

        if (!searchRes.ok) throw new Error(`Jira Search failed: ${searchRes.statusText}`);
        const searchData = await searchRes.json();
        const issues = searchData.issues || [];

        const meRes = await apiFetch('/api/jira/rest/api/3/myself');
        if (!meRes.ok) throw new Error(`Jira Myself failed: ${meRes.statusText}`);
        const meData = await meRes.json();
        const currentUserAccountId = meData.accountId;

        for (const issue of issues) {
            const worklogRes = await apiFetch(`/api/jira/rest/api/3/issue/${issue.key}/worklog`);

            if (!worklogRes.ok) continue;

            const worklogDataRaw = await worklogRes.json();
            const worklogs = worklogDataRaw.worklogs || [];

            const userWorklogs = worklogs.filter(
                (l: any) => l.author?.accountId === currentUserAccountId
            );
            for (const log of userWorklogs) {
                const logDate = new Date(log.started);

                if (logDate >= startDate && logDate < addDays(endDate, 1)) {
                    const dayBox = worklogData.find(d => isSameDay(new Date(d.date), logDate));

                    if (!dayBox) continue;

                    const hours = (log.timeSpentSeconds || 0) / 3600;
                    const existingTicket = dayBox.tickets.find(t => t.id === issue.key);

                    if (existingTicket) {
                        existingTicket.loggedHours += hours;
                    } else {
                        dayBox.tickets.push({
                            id: issue.key,
                            summary: issue.fields?.summary || "Unknown Task",
                            loggedHours: hours,
                            projectKey: issue.fields?.project?.key || "UNK"
                        });
                    }

                    dayBox.totalHours += hours;
                }
            }
        }

        worklogData.forEach(day => {
            day.totalHours = parseFloat(day.totalHours.toFixed(2));
            day.tickets.forEach(t => t.loggedHours = parseFloat(t.loggedHours.toFixed(2)));
        });

    } catch (error) {
        throw error;
    }

    return worklogData;
};

export const fetchWeeklyWorklogs = async (currentDate: Date): Promise<DayWorklog[]> => {
    const activeAuth = getActiveAuth();
    const firstDayOfWeek = activeAuth?.firstDayOfWeek ?? 1; // Default to Monday
    const weekStart = startOfWeek(currentDate, { weekStartsOn: firstDayOfWeek });
    const weekEnd = addDays(weekStart, 6);
    return fetchWorklogs(weekStart, weekEnd);
};

export const fetchMonthlyWorklogs = async (currentDate: Date): Promise<DayWorklog[]> => {
    const activeAuth = getActiveAuth();
    const firstDayOfWeek = activeAuth?.firstDayOfWeek ?? 1;
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    
    // For a better grid, fetch from the start of the first week of the month 
    // to the end of the last week.
    const gridStart = startOfWeek(monthStart, { weekStartsOn: firstDayOfWeek });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: firstDayOfWeek });
    
    return fetchWorklogs(gridStart, gridEnd);
};
