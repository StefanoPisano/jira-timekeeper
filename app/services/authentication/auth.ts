import type { JiraAuth } from '../../types/jira';
import { apiFetch } from "@/app/services/api/apiClient";
import { getAuthHeaders } from "@/app/services/api/headersUtil";

const getStorageValue = (key: string) => typeof window !== 'undefined' ? localStorage.getItem(key) : null;

export const getActiveAuth = (): JiraAuth | null => {
    const authsJson = getStorageValue('JIRA_AUTHS');
    if (!authsJson) return null;

    try {
        const auths: JiraAuth[] = JSON.parse(authsJson);
        const activeId = getStorageValue('ACTIVE_JIRA_AUTH_ID');
        const active: any = auths.find(a => a.id === activeId) || auths[0] || null;
        if (active && active.workingHours === undefined) {
            active.workingHours = 8;
        }
        if (active && active.workingDays === undefined) {
            // Migrate from showWeekends or default to Mon-Fri
            if (active.showWeekends) {
                active.workingDays = [0, 1, 2, 3, 4, 5, 6];
            } else {
                active.workingDays = [1, 2, 3, 4, 5];
            }
            delete active.showWeekends;
        }
        return active as JiraAuth;
    } catch (e) {
        return null;
    }
};

export const testConnection = async (auth: JiraAuth): Promise<boolean> => {
    try {
        const email = auth.email.trim();
        const token = auth.token.trim();
        const domain = auth.domain.trim();

        const headers = getAuthHeaders(email, token, domain);
        const response = await apiFetch(`/api/jira/rest/api/3/myself`, headers);
        return response.ok;
    } catch (e) {
        return false;
    }
};
