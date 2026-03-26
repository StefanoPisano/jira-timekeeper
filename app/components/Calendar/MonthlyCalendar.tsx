import React, { useEffect, useState } from 'react';
import { addMonths, format, startOfMonth, endOfMonth, subMonths, isSameDay, startOfWeek, endOfWeek, addDays, isSameMonth } from 'date-fns';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Loader2, RefreshCcw } from 'lucide-react';
import type { DayWorklog } from '../../types/jira.ts';
import { fetchMonthlyWorklogs } from '../../services/worklogs';
import { getActiveAuth } from '../../services/authentication/auth';
import { DayCard } from '../DayCard/DayCard';
import { isWeekend } from 'date-fns';
import "../../styles/Calendar.scss"

interface CalendarProps {
    view: 'weekly' | 'monthly';
    onViewChange: (view: 'weekly' | 'monthly') => void;
}

export const MonthlyCalendar: React.FC<CalendarProps> = ({ view, onViewChange }) => {
    const [forceRefresh, setForceRefresh] = useState<number | null>(null);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [worklogs, setWorklogs] = useState<DayWorklog[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [monthlyTotal, setMonthlyTotal] = useState(0);

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            setError(null);
            try {
                const data = await fetchMonthlyWorklogs(currentDate);
                setWorklogs(data);

                const total = data.reduce((sum, day) => sum + day.totalHours, 0);
                setMonthlyTotal(parseFloat(total.toFixed(1)));
            } catch (err: any) {
                setError(err.message || "An error occurred while fetching Jira data.");
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [currentDate, forceRefresh]);

    const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
    const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));
    const handleToday = () => setCurrentDate(new Date());
    const handleRefresh = () => setForceRefresh(Math.random());

    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const monthLabel = format(currentDate, 'MMMM yyyy');

    const activeAuth = getActiveAuth();
    const workingDays = activeAuth?.workingDays || [1, 2, 3, 4, 5];
    const firstDayOfWeek = activeAuth?.firstDayOfWeek ?? 1;
    
    // For the grid, we want to show full weeks.
    const gridStart = startOfWeek(monthStart, { weekStartsOn: firstDayOfWeek });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: firstDayOfWeek });
    
    const days: Date[] = [];
    let curr = gridStart;
    while (curr <= gridEnd) {
        days.push(curr);
        curr = addDays(curr, 1);
    }

    const colCount = workingDays.length;

    return (
        <div className="calendar-container monthly-view">
            <header className="calendar-header">
                <div className="header-left">
                    <CalendarIcon className="header-icon" />
                    <div className="view-switcher-inline">
                        <button 
                            className={view === 'weekly' ? 'active' : ''}
                            onClick={() => onViewChange('weekly')}
                        >
                            Weekly
                        </button>
                        <button 
                            className={view === 'monthly' ? 'active' : ''}
                            onClick={() => onViewChange('monthly')}
                        >
                            Monthly
                        </button>
                    </div>
                </div>

                <div className="header-controls">
                    <button className="btn btn-outline" onClick={handleToday}>
                        Today
                    </button>

                    <div className="week-navigation">
                        <button className="btn btn-icon" onClick={handlePrevMonth} aria-label="Previous Month">
                            <ChevronLeft size={20} />
                        </button>
                        <span className="week-range">{monthLabel}</span>
                        <button className="btn btn-icon" onClick={handleNextMonth} aria-label="Next Month">
                            <ChevronRight size={20} />
                        </button>
                    </div>

                    <button className="btn btn-outline" onClick={handleRefresh}>
                        <RefreshCcw size={20} />
                    </button>
                </div>

                <div className="header-right">
                    <div className="weekly-summary">
                        <span className="summary-label">Month Total:</span>
                        <span className="summary-value">{monthlyTotal}h</span>
                    </div>
                </div>
            </header>

            <div className="calendar-grid-wrapper">
                {error ? (
                    <div className="error-state">
                        <p>{error}</p>
                        <p className="help-text mt-4">Check your Jira authentication in the navigation bar.</p>
                    </div>
                ) : loading ? (
                    <div className="loading-state">
                        <Loader2 className="spinner" size={40} />
                        <p>Loading your tickets...</p>
                    </div>
                ) : (
                    <div className="calendar-grid monthly-grid" style={{ '--col-count': colCount } as React.CSSProperties}>
                        {days
                            .filter(day => workingDays.includes(day.getDay()))
                            .map((day: Date) => {
                                const dayStr = format(day, 'yyyy-MM-dd');
                                const worklog = worklogs.find(log => log.date === dayStr) || {
                                    date: dayStr,
                                    tickets: [],
                                    totalHours: 0
                                };
                                const isCurrentMonth = isSameMonth(day, currentDate);
                                
                                return (
                                    <div key={dayStr} className={`grid-day-cell ${!isCurrentMonth ? 'other-month' : ''}`}>
                                        <DayCard worklog={worklog} isCompact={true} />
                                    </div>
                                );
                            })}
                    </div>
                )}
            </div>
        </div>
    );
};
