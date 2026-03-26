import React from 'react';
import {Clock} from 'lucide-react';
import type {Ticket} from '../../types/jira';
import {getActiveAuth} from "@/app/services/authentication/auth";
import "../../styles/TicketItem.scss"

interface TicketItemProps {
    ticket: Ticket;
    isCompact?: boolean;
}

export const TicketItem: React.FC<TicketItemProps> = ({ ticket, isCompact }) => {
    const active = getActiveAuth();
    const domain = active?.domain;
    const url = `https://${domain}/browse/${ticket.id}`
    return (
        <div className={`ticket-item ${isCompact ? 'is-compact' : ''}`}>
            <div className="ticket-header">
                <span className="ticket-id"><a href={url} target={"_blank"}>{ticket.id}</a></span>
                <div className="ticket-hours">
                    <Clock size={12} className="clock-icon" />
                    <span>{ticket.loggedHours}h</span>
                </div>
            </div>
            {!isCompact && <p className="ticket-summary">{ticket.summary}</p>}
        </div>
    );
};
