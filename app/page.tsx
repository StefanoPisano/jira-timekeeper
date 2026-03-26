'use client';

import {useState} from 'react';
import {WeeklyCalendar} from './components/Calendar/WeeklyCalendar';
import {MonthlyCalendar} from './components/Calendar/MonthlyCalendar';
import {NavigationBar} from './components/NavigationBar/NavigationBar';
import Footer from "@/app/components/Footer/Footer";
import logo from './assets/logo_white.png';

export default function Page() {
    const [refreshKey, setRefreshKey] = useState(0);
    const [view, setView] = useState<'weekly' | 'monthly'>('weekly');

    const handleAuthChange = () => {
        setRefreshKey(prev => prev + 1);
    };

    return (
        <div className="app-layout">
            <header className="top-nav">
                <div className="logo-container">
                    <img src={logo.src} className={"w-12"} alt={"Jira Timekeeper logo"}/>
                    <span className="app-name">Jira Timekeeper</span>
                </div>
                <NavigationBar onAuthChange={handleAuthChange} />
            </header>

            <div className="main-content flex flex-col justify-between">
                <main className={"flex-1"}>
                    {view === 'weekly' ? (
                        <WeeklyCalendar 
                            key={`weekly-${refreshKey}`} 
                            view={view} 
                            onViewChange={setView} 
                        />
                    ) : (
                        <MonthlyCalendar 
                            key={`monthly-${refreshKey}`} 
                            view={view} 
                            onViewChange={setView} 
                        />
                    )}
                </main>
                <Footer></Footer>
            </div>
        </div>
    );
}