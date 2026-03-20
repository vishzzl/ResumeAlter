'use client';

import { useActionState, useEffect, useState } from 'react';
import { createUser, getUsers, deleteUser, resetUserPassword } from '@/actions/admin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, UserPlus, Loader2, Trash2, Key } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface User {
    id: number;
    email: string;
    role: string;
    createdAt: string | null;
}

export default function AdminUsersPage() {
    const [state, formAction, isPending] = useActionState(createUser, null);
    const [users, setUsers] = useState<User[]>([]);
    const [isLoadingUsers, setIsLoadingUsers] = useState(true);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // Modal States
    const [userToDelete, setUserToDelete] = useState<User | null>(null);
    const [userToReset, setUserToReset] = useState<User | null>(null);
    const [newPassword, setNewPassword] = useState('');
    const [isActionPending, setIsActionPending] = useState(false);
    const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => {
        async function fetchUsers() {
            try {
                const data = await getUsers();
                setUsers(data as User[]);
            } catch (error) {
                console.error('Failed to fetch users', error);
            } finally {
                setIsLoadingUsers(false);
            }
        }
        fetchUsers();
    }, [state, refreshTrigger]); // Refresh table when a new user is created or action taken

    const handleDeleteUser = async () => {
        if (!userToDelete) return;
        setIsActionPending(true);
        setActionMessage(null);
        try {
            const result = await deleteUser(userToDelete.id);
            if (result.success) {
                setUserToDelete(null);
                setRefreshTrigger(prev => prev + 1);
            } else {
                setActionMessage({ type: 'error', text: result.message || 'Failed to delete' });
            }
        } catch (error) {
            setActionMessage({ type: 'error', text: 'An unexpected error occurred' });
        } finally {
            setIsActionPending(false);
        }
    };

    const handleResetPassword = async () => {
        if (!userToReset || !newPassword) return;
        setIsActionPending(true);
        setActionMessage(null);
        try {
            const result = await resetUserPassword(userToReset.id, newPassword);
            if (result.success) {
                setUserToReset(null);
                setNewPassword('');
                // Successfully reset, triggering refetch isn't strictly necessary but we can clear stated
                setRefreshTrigger(prev => prev + 1);
            } else {
                setActionMessage({ type: 'error', text: result.message || 'Failed to reset password' });
            }
        } catch (error) {
            setActionMessage({ type: 'error', text: 'An unexpected error occurred' });
        } finally {
            setIsActionPending(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">User Management</h1>
                    <p className="text-slate-500">View and manage users.</p>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {/* Create User Form */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <UserPlus className="h-5 w-5 text-indigo-600" />
                            Invite User
                        </CardTitle>
                        <CardDescription>Create a new user account manually.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form action={formAction} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input id="email" name="email" type="email" required placeholder="user@example.com" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="password">Temporary Password</Label>
                                <Input id="password" name="password" type="password" required placeholder="••••••••" />
                            </div>

                            {state?.message && (
                                <div className={`p-3 rounded-md flex items-center gap-2 text-sm ${state.message === 'Success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                    {state.message === 'Success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                                    {state.message === 'Success' ? 'User created successfully' : state.message}
                                </div>
                            )}

                            <Button type="submit" disabled={isPending} className="w-full">
                                {isPending ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Creating...
                                    </>
                                ) : (
                                    'Create User'
                                )}
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                {/* User List */}
                <Card className="md:col-span-2 lg:col-span-1">
                    <CardHeader>
                        <CardTitle className="text-lg">Registered Users</CardTitle>
                        <CardDescription>Total users: {users.length}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoadingUsers ? (
                            <div className="flex justify-center p-8">
                                <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
                            </div>
                        ) : (
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Email</TableHead>
                                            <TableHead>Role</TableHead>
                                            <TableHead className="text-right">Created</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {users.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={4} className="text-center text-slate-500 py-6">
                                                    No users found.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            users.map((user) => (
                                                <TableRow key={user.id}>
                                                    <TableCell className="font-medium">{user.email}</TableCell>
                                                    <TableCell>
                                                        <Badge variant={user.role === 'admin' ? 'default' : 'secondary'} className="capitalize">
                                                            {user.role}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right text-slate-500 text-xs">
                                                        {new Date(user.createdAt!).toLocaleDateString()}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex justify-end gap-2">
                                                            <Button variant="ghost" size="icon" onClick={() => setUserToReset(user)} title="Reset Password" type="button">
                                                                <Key className="h-4 w-4 text-slate-500" />
                                                            </Button>
                                                            <Button variant="ghost" size="icon" onClick={() => setUserToDelete(user)} title="Delete User" type="button">
                                                                <Trash2 className="h-4 w-4 text-red-500" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Delete Confirmation Dialog */}
            <Dialog open={!!userToDelete} onOpenChange={(open) => {
                if (!open) {
                    setUserToDelete(null);
                    setActionMessage(null);
                }
            }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete User</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete the user <strong className="break-all">{userToDelete?.email}</strong>? This action cannot be undone and will delete all their applications and profile data.
                        </DialogDescription>
                    </DialogHeader>
                    {actionMessage && userToDelete && (
                        <div className={`p-3 rounded-md flex items-center gap-2 text-sm ${actionMessage.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                            {actionMessage.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                            {actionMessage.text}
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setUserToDelete(null)} disabled={isActionPending} type="button">Cancel</Button>
                        <Button variant="destructive" onClick={handleDeleteUser} disabled={isActionPending} type="button">
                            {isActionPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Delete User
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Reset Password Dialog */}
            <Dialog open={!!userToReset} onOpenChange={(open) => {
                if (!open) {
                    setUserToReset(null);
                    setNewPassword('');
                    setActionMessage(null);
                }
            }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Reset Password</DialogTitle>
                        <DialogDescription>
                            Enter a new password for <strong className="break-all">{userToReset?.email}</strong>.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="new-password">New Password</Label>
                            <Input
                                id="new-password"
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="••••••••"
                            />
                        </div>
                        {actionMessage && userToReset && (
                            <div className={`p-3 rounded-md flex items-center gap-2 text-sm ${actionMessage.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                {actionMessage.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                                {actionMessage.text}
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setUserToReset(null)} disabled={isActionPending} type="button">Cancel</Button>
                        <Button onClick={handleResetPassword} disabled={!newPassword || isActionPending} type="button">
                            {isActionPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Reset Password
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
