import React, { useState, useEffect, useRef } from 'react';
import {
    Key,
    Trash2,
    Edit2,
    CheckCircle2,
    X,
    Info,
    HelpCircle,
    FolderDownIcon, FolderUpIcon, Lock, Unlock, Share2, ClipboardCheck, ArrowRightLeft
} from 'lucide-react';
import type { JiraAuth } from '../../types/jira';
import { getActiveAuth, testConnection } from "../../services/authentication/auth";
import { encryptData, decryptData, validatePassword } from "../../utils/crypto";
import { shareContent } from "../../utils/share";
import "../../styles/Modal.scss";
import "../../styles/NavigationBar.scss";

interface AuthNavProps {
    onAuthChange: () => void;
}

export const NavigationBar: React.FC<AuthNavProps> = ({ onAuthChange }) => {
    const [auths, setAuths] = useState<JiraAuth[]>([]);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [currentAuth, setCurrentAuth] = useState<Partial<JiraAuth>>({});
    const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
    const [isExporting, setIsExporting] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [isSharing, setIsSharing] = useState(false);
    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [importFile, setImportFile] = useState<File | null>(null);
    const [importHashData, setImportHashData] = useState<string | null>(null);
    const [passError, setPassError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const loadAuths = () => {
        const storedAuths = localStorage.getItem('JIRA_AUTHS');
        if (storedAuths) {
            try {
                const parsed = JSON.parse(storedAuths);
                setAuths(parsed);
                const active = localStorage.getItem('ACTIVE_JIRA_AUTH_ID');
                setActiveId(active || (parsed.length > 0 ? parsed[0].id : null));
            } catch (e) {
                console.error("Failed to load auths", e);
            }
        }
    };

    useEffect(() => {
        loadAuths();

        // Check for share link in hash
        const hash = window.location.hash;
        if (hash.startsWith('#import=')) {
            const data = decodeURIComponent(hash.substring(8));
            setImportHashData(data);
            setIsImporting(true);
            setPassword('');
            setPassError(null);
            // Clear hash to avoid re-triggering on refresh if user cancels
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
        }
    }, []);

    const handleSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const value = event.target.value;
        localStorage.setItem('ACTIVE_JIRA_AUTH_ID', value);
        setActiveId(value);
        onAuthChange();
    };


    const handleAdd = () => {
        setCurrentAuth({
            id: crypto.randomUUID(),
            label: '',
            domain: '',
            email: '',
            token: '',
            workingHours: 8,
            workingDays: [1, 2, 3, 4, 5]
        });
        setIsEditing(true);
    };

    const handleEdit = () => {
        const currentAuth = getActiveAuth();
        if (currentAuth) {
            setCurrentAuth(currentAuth);
            setIsEditing(true);
        }
    };

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        const currentAuth = getActiveAuth();
        const deletedId = currentAuth?.id;
        const updated = auths.filter(a => a.id !== deletedId);
        localStorage.setItem('JIRA_AUTHS', JSON.stringify(updated));

        const nextActive = updated.length > 0 ? updated[0].id : null;
        if (nextActive) localStorage.setItem('ACTIVE_JIRA_AUTH_ID', nextActive);
        else localStorage.removeItem('ACTIVE_JIRA_AUTH_ID');
        setActiveId(nextActive);

        setAuths(updated);
        onAuthChange();
    };

    const handleTest = async () => {
        if (!currentAuth.email || !currentAuth.token) return;
        setTestStatus('testing');
        const success = await testConnection({
            ...currentAuth,
            email: currentAuth.email.trim(),
            token: currentAuth.token.trim(),
            domain: (currentAuth.domain || '').trim()
        } as JiraAuth);
        setTestStatus(success ? 'success' : 'error');
    };

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();

        const trimmedAuth: JiraAuth = {
            id: currentAuth.id!,
            label: (currentAuth.label || '').trim(),
            domain: (currentAuth.domain || '').trim().replace(/^https?:\/\//, ''),
            email: (currentAuth.email || '').trim(),
            token: (currentAuth.token || '').trim(),
            workingHours: currentAuth.workingHours || 8,
            workingDays: currentAuth.workingDays || [1, 2, 3, 4, 5],
            firstDayOfWeek: currentAuth.firstDayOfWeek ?? 1
        };

        addAuth(trimmedAuth);
        setIsEditing(false);
        setTestStatus("idle")
        onAuthChange();
    };

    const addAuth = (auth: JiraAuth) => {
        const updatedAuths = [...auths];
        const index = updatedAuths.findIndex(a => a.id === auth.id);

        if (index >= 0) {
            updatedAuths[index] = auth;
        } else {
            updatedAuths.push(auth);
        }

        localStorage.setItem('JIRA_AUTHS', JSON.stringify(updatedAuths));
        if (updatedAuths.length === 1 || activeId === currentAuth.id) {
            localStorage.setItem('ACTIVE_JIRA_AUTH_ID', currentAuth.id!);
            setActiveId(currentAuth.id!);
        }

        setAuths(updatedAuths);
    }

    const handleExportAuth = () => {
        setIsExporting(true);
        setPassword('');
        setConfirmPassword('');
        setPassError(null);
    }

    const confirmExport = async () => {
        const error = validatePassword(password);
        if (error) {
            setPassError(error);
            return;
        }

        if (password !== confirmPassword) {
            setPassError("Passwords do not match.");
            return;
        }

        const currentAuth = getActiveAuth();
        if (!currentAuth) return;

        try {
            const jsonStr = JSON.stringify(currentAuth);
            const encryptedData = await encryptData(jsonStr, password);

            const filename = `${currentAuth.label || 'profile'}_credentials.json`;
            const element = document.createElement('a');
            element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(encryptedData));
            element.setAttribute('download', filename);

            element.style.display = 'none';
            document.body.appendChild(element);
            element.click();
            document.body.removeChild(element);

            setIsExporting(false);
            setPassword('');
        } catch (err) {
            console.error("Encryption failed", err);
            setPassError("Encryption failed. Please try again.");
        }
    }

    const handleShareAuth = () => {
        setIsSharing(true);
        setPassword('');
        setConfirmPassword('');
        setPassError(null);
    }

    const confirmShare = async () => {
        const error = validatePassword(password);
        if (error) {
            setPassError(error);
            return;
        }

        if (password !== confirmPassword) {
            setPassError("Passwords do not match.");
            return;
        }

        const currentAuth = getActiveAuth();
        if (!currentAuth) return;

        try {
            const jsonStr = JSON.stringify(currentAuth);
            const encryptedData = await encryptData(jsonStr, password);

            const baseUrl = window.location.origin + window.location.pathname;
            const shareUrl = `${baseUrl}#import=${encodeURIComponent(encryptedData)}`;

            const result = await shareContent({
                title: 'Jira Profile',
                text: `Import my Jira profile: ${currentAuth.label}`,
                url: shareUrl
            });

            if (result !== 'failed') {
                setSuccessMessage(result === 'shared' ? 'Profile shared!' : 'Link copied to clipboard!');
                setTimeout(() => setSuccessMessage(null), 3000);
                setIsSharing(false);
                setPassword('');
                setConfirmPassword('');
            } else {
                setPassError("Sharing failed. Please try again.");
            }
        } catch (err) {
            console.error("Sharing failed", err);
            setPassError("Sharing failed. Please try again.");
        }
    }

    const handleImportButtonClick = () => fileInputRef.current?.click();

    const handleImportAuth = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setImportFile(file);
            setIsImporting(true);
            setPassword('');
            setPassError(null);
            // Reset file input so same file can be selected again
            event.target.value = '';
        }
    }

    const confirmImport = async () => {
        if (!importFile && !importHashData) return;

        const processData = async (data: string) => {
            try {
                const decryptedData = await decryptData(data, password);
                const content = JSON.parse(decryptedData);

                // Validation
                const requiredFields: (keyof JiraAuth)[] = ['label', 'domain', 'email', 'token'];
                const missingFields = requiredFields.filter(field => !content[field]);

                if (missingFields.length > 0) {
                    setPassError(`Invalid profile data. Missing required fields.`);
                    return;
                }

                const auth: JiraAuth = {
                    id: content.id || crypto.randomUUID(),
                    label: (content.label || '').trim(),
                    domain: (content.domain || '').trim().replace(/^https?:\/\//, ''),
                    email: (content.email || '').trim(),
                    token: (content.token || '').trim(),
                    workingHours: content.workingHours || 8,
                    workingDays: content.workingDays || (content.showWeekends ? [0, 1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5]),
                    firstDayOfWeek: content.firstDayOfWeek ?? 1
                };

                addAuth(auth);
                onAuthChange();
                setIsImporting(false);
                setPassword('');
                setImportFile(null);
                setImportHashData(null);
            } catch (err) {
                console.error("Failed to decrypt or parse imported data", err);
                setPassError("Incorrect password or invalid data.");
            }
        };

        if (importHashData) {
            await processData(importHashData);
        } else if (importFile) {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const result = e.target?.result;
                if (typeof result === 'string') {
                    await processData(result);
                }
            };
            reader.readAsText(importFile);
        }
    }

    return (
        <div className="auth-nav-content">
            <div className={"auth-nav-profile"}>
                <div className="nav-auth-list">
                    <select
                        className="w-full select___auth-list"
                        onChange={handleSelect}
                        disabled={auths.length === 0}
                        value={activeId || ''}
                    >
                        {auths.length === 0 && <option value="">No profiles</option>}
                        {auths.map(auth => (
                            <option key={auth.id} id={auth.id} value={auth.id}>
                                {auth.label}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="nav-actions flex gap-1.5">
                    <button className="btn-icon-sm" onClick={handleAdd} title="Add New Auth">
                        <Key size={24} />
                    </button>
                    <button className="btn-icon-sm" onClick={handleEdit} disabled={auths.length === 0 || getActiveAuth() == null}>
                        <Edit2 size={24} />
                    </button>
                    <button className="btn-icon-sm text-error" onClick={handleDelete} disabled={auths.length === 0 || getActiveAuth() == null}>
                        <Trash2 size={24} />
                    </button>
                    <button className="btn-icon-sm" onClick={() => setIsTransferModalOpen(true)} title="Import / Export / Share Profiles">
                        <ArrowRightLeft size={24} />
                    </button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        onChange={handleImportAuth}
                        accept=".json"
                    />
                </div>
            </div>

            {isEditing && (
                <div className="settings-overlay">
                    <div className="settings-modal" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-6">
                            <h2>{currentAuth.label ? 'Edit' : 'Add'} Jira Profile</h2>
                        </div>

                        <form onSubmit={handleSave}>
                            <div className="form-group">
                                <label>Profile Label</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Work, Personal, Client X"
                                    value={currentAuth.label || ''}
                                    onChange={(e) => setCurrentAuth({ ...currentAuth, label: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label>Jira Domain</label>
                                <input
                                    type="text"
                                    placeholder="e.g. your-company.atlassian.net"
                                    value={currentAuth.domain || ''}
                                    onChange={(e) => setCurrentAuth({ ...currentAuth, domain: e.target.value })}
                                />
                                <p className="help-text">Leave empty to use the default configured domain.</p>
                            </div>

                            <div className="form-group">
                                <label>Jira Email</label>
                                <input
                                    type="email"
                                    placeholder="your-email@company.com"
                                    value={currentAuth.email || ''}
                                    onChange={(e) => setCurrentAuth({ ...currentAuth, email: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label>API Token</label>
                                <input
                                    type="password"
                                    placeholder="Your Jira API Token"
                                    value={currentAuth.token || ''}
                                    onChange={(e) => setCurrentAuth({ ...currentAuth, token: e.target.value })}
                                    required
                                />
                                <div className="help-text flex items-center gap-1">
                                    <Info size={12} />
                                    <span>Create one at id.atlassian.com/manage/api-tokens</span>
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Daily Working Hours</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="24"
                                    step="0.5"
                                    placeholder="e.g. 8"
                                    value={currentAuth.workingHours || 8}
                                    onChange={(e) => setCurrentAuth({ ...currentAuth, workingHours: parseFloat(e.target.value) })}
                                    required
                                />
                                <p className="help-text">Expected hours per day for status indicators.</p>
                            </div>

                            <div className="form-group">
                                <label className="block text-sm font-medium text-text-secondary mb-2">Working Days</label>
                                <div className="days-selection-toggle">
                                    {(() => {
                                        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                                        const startDay = currentAuth.firstDayOfWeek ?? 1;
                                        return Array.from({ length: 7 }).map((_, i) => {
                                            const dayIndex = (i + startDay) % 7;
                                            const dayName = dayNames[dayIndex];
                                            const isSelected = (currentAuth.workingDays || [1, 2, 3, 4, 5]).includes(dayIndex);
                                            return (
                                                <button
                                                    key={dayName}
                                                    type="button"
                                                    className={isSelected ? 'active' : ''}
                                                    onClick={() => {
                                                        const days = currentAuth.workingDays || [1, 2, 3, 4, 5];
                                                        const nextDays = days.includes(dayIndex)
                                                            ? days.filter(d => d !== dayIndex)
                                                            : [...days, dayIndex].sort();
                                                        setCurrentAuth({ ...currentAuth, workingDays: nextDays });
                                                    }}
                                                >
                                                    {dayName}
                                                </button>
                                            );
                                        });
                                    })()}
                                </div>
                            </div>

                            <div className="form-group">
                                <label htmlFor="firstDayOfWeek" className="block text-sm font-medium text-text-secondary mb-1">First Day of Week</label>
                                <select
                                    id="firstDayOfWeek"
                                    value={currentAuth.firstDayOfWeek ?? 1}
                                    onChange={(e) => setCurrentAuth({ ...currentAuth, firstDayOfWeek: parseInt(e.target.value) as 0 | 1 })}
                                    className="w-full bg-bg-primary border border-border-light rounded-md p-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary"
                                >
                                    <option value={1}>Monday</option>
                                    <option value={0}>Sunday</option>
                                </select>
                            </div>

                            <div className="settings-actions">
                                <button
                                    type="button"
                                    className={`btn btn-outline ${testStatus === 'testing' ? 'opacity-50' : ''}`}
                                    onClick={handleTest}
                                    disabled={testStatus === 'testing' || !currentAuth.email || !currentAuth.token}
                                >
                                    {testStatus === 'testing' ? 'Testing...' : 'Test'}
                                </button>
                                <div className="flex-1"></div>
                                <button type="button" className="btn btn-outline" onClick={() => {
                                    setIsEditing(false);
                                    setTestStatus("idle");
                                }}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    Save
                                </button>
                            </div>

                            {testStatus !== 'idle' && (
                                <div
                                    className={`mt-4 p-3 rounded-md text-sm flex items-center gap-2 ${testStatus === 'success' ? 'bg-success/10 text-success' :
                                        testStatus === 'error' ? 'bg-danger/10 text-danger' :
                                            'bg-accent/10 text-accent'
                                        }`}>
                                    {testStatus === 'success' && <CheckCircle2 size={16} />}
                                    {testStatus === 'error' && <X size={16} />}
                                    {testStatus === 'testing' && <HelpCircle size={16} className="animate-spin" />}
                                    <span>
                                        {testStatus === 'success' && 'Connection successful!'}
                                        {testStatus === 'error' && 'Connection failed. Please check your credentials and domain.'}
                                        {testStatus === 'testing' && 'Attempting to connect to Jira...'}
                                    </span>
                                </div>
                            )}
                        </form>
                    </div>
                </div>
            )}
            {isExporting && (
                <div className="settings-overlay">
                    <div className="settings-modal" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="flex items-center gap-2">
                                <Lock size={20} />
                                Encrypt Profile Export
                            </h2>
                        </div>
                        <p className="mb-4 text-sm text-accent">
                            Choose a password to encrypt your profile. You will need this password when importing the file.
                        </p>
                        <div className="form-group">
                            <label>Export Password</label>
                            <input
                                type="password"
                                placeholder="6-18 chars, numbers, caps & symbols"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                autoFocus
                            />
                        </div>
                        <div className="form-group mt-2">
                            <label>Confirm Password</label>
                            <input
                                type="password"
                                placeholder="Re-enter password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                            />
                            {passError && <p className="text-danger text-xs mt-1">{passError}</p>}
                        </div>
                        <div className="settings-actions mt-6">
                            <button type="button" className="btn btn-outline" onClick={() => setIsExporting(false)}>
                                Cancel
                            </button>
                            <button type="button" className="btn btn-primary" onClick={confirmExport}>
                                Export Encrypted
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isImporting && (
                <div className="settings-overlay">
                    <div className="settings-modal" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="flex items-center gap-2">
                                <Unlock size={20} />
                                Decrypt Profile Import
                            </h2>
                        </div>
                        <p className="mb-4 text-sm text-accent">
                            Enter the password that was used to encrypt this profile.
                        </p>
                        <div className="form-group">
                            <label>Decryption Password</label>
                            <input
                                type="password"
                                placeholder="Enter password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                autoFocus
                                onKeyDown={(e) => e.key === 'Enter' && confirmImport()}
                            />
                            {passError && <p className="text-danger text-xs mt-1">{passError}</p>}
                        </div>
                        <div className="settings-actions mt-6">
                            <button type="button" className="btn btn-outline" onClick={() => {
                                setIsImporting(false);
                                setImportFile(null);
                                setImportHashData(null);
                            }}>
                                Cancel
                            </button>
                            <button type="button" className="btn btn-primary" onClick={confirmImport}>
                                Import & Decrypt
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isSharing && (
                <div className="settings-overlay">
                    <div className="settings-modal" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="flex items-center gap-2">
                                <Share2 size={20} />
                                Share Profile Link
                            </h2>
                        </div>
                        <p className="mb-4 text-sm text-accent">
                            Choose a password to encrypt your profile link. The recipient will need this password to import the profile.
                        </p>
                        <div className="form-group">
                            <label>Sharing Password</label>
                            <input
                                type="password"
                                placeholder="6-18 chars, numbers, caps & symbols"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                autoFocus
                            />
                        </div>
                        <div className="form-group mt-2">
                            <label>Confirm Password</label>
                            <input
                                type="password"
                                placeholder="Re-enter password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                            />
                            {passError && <p className="text-danger text-xs mt-1">{passError}</p>}
                        </div>
                        <div className="settings-actions mt-6">
                            <button type="button" className="btn btn-outline" onClick={() => setIsSharing(false)}>
                                Cancel
                            </button>
                            <button type="button" className="btn btn-primary" onClick={confirmShare}>
                                Copy Share Link
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isTransferModalOpen && (
                <div className="settings-overlay">
                    <div className="settings-modal transfer-modal" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="flex items-center gap-2">
                                <ArrowRightLeft size={20} />
                                Transfer Profiles
                            </h2>
                            <button className="btn-icon-sm" onClick={() => setIsTransferModalOpen(false)}>
                                <X size={20} />
                            </button>
                        </div>

                        <div className="transfer-options grid grid-cols-1 gap-4">
                            <button
                                className="btn btn-outline flex flex-col items-center justify-center p-6 h-auto gap-3 text-center"
                                onClick={() => {
                                    setIsTransferModalOpen(false);
                                    handleImportButtonClick();
                                }}
                            >
                                <FolderUpIcon size={32} />
                                <div>
                                    <div className="font-bold">Import Profile</div>
                                    <div className="text-xs text-accent">Upload a .json file</div>
                                </div>
                            </button>

                            <button
                                className="btn btn-outline flex flex-col items-center justify-center p-6 h-auto gap-3 text-center"
                                disabled={auths.length === 0 || getActiveAuth() == null}
                                onClick={() => {
                                    setIsTransferModalOpen(false);
                                    handleExportAuth();
                                }}
                            >
                                <FolderDownIcon size={32} />
                                <div>
                                    <div className="font-bold">Export Profile</div>
                                    <div className="text-xs text-accent">Download as encrypted .json</div>
                                </div>
                            </button>

                            <button
                                className="btn btn-outline flex flex-col items-center justify-center p-6 h-auto gap-3 text-center"
                                disabled={auths.length === 0 || getActiveAuth() == null}
                                onClick={() => {
                                    setIsTransferModalOpen(false);
                                    handleShareAuth();
                                }}
                            >
                                <Share2 size={32} />
                                <div>
                                    <div className="font-bold">Share Link</div>
                                    <div className="text-xs text-accent">Copy encrypted link to clipboard</div>
                                </div>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {successMessage && (
                <div className="fixed bottom-4 right-4 bg-success text-white p-3 rounded-md shadow-lg flex items-center gap-2 animate-bounce">
                    <ClipboardCheck size={20} />
                    <span>{successMessage}</span>
                </div>
            )}
        </div>
    );
};
