export interface Ticket {
    id: string; // Issue Key (e.g., PROJ-123)
    summary: string;
    loggedHours: number;
    projectKey: string;
}

export interface DayWorklog {
    date: string; // ISO string YYYY-MM-DD
    tickets: Ticket[];
    totalHours: number;
}

export interface JiraAuth {
    id: string;
    label: string;
    domain: string;
    email: string;
    token: string;
    workingHours?: number;
    workingDays?: number[]; // [0, 1, 2, 3, 4, 5, 6] where 0 is Sunday
    firstDayOfWeek?: 0 | 1; // 0: Sunday, 1: Monday
}
