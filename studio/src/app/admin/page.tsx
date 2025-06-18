
"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useDefectTypes } from '@/hooks/useDefectTypes';
import { useInspectionData } from '@/hooks/useInspectionData';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, doc, updateDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import type { UserProfile, UserRole } from '@/lib/types';
import { USER_ROLES_LIST, USERS_COLLECTION } from '@/lib/constants';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ShieldAlert, Users, CheckCircle, XCircle, UserCog, Edit3, Save, ListPlus, Tag, Trash2, AlertTriangle as AlertTriangleIcon } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const getStatusBadgeVariant = (status: UserProfile['status'] | undefined): "default" | "secondary" | "destructive" => {
  switch (status) {
    case 'active': return 'default';
    case 'pending_approval': return 'secondary';
    case 'suspended': return 'destructive';
    default: return 'secondary';
  }
};

export default function AdminPage() {
  const { currentUser, loading: authLoading } = useAuth();
  const { currentRole: loggedInUserRole, isLoadingRole: isRoleLoading } = useUserRole();
  const router = useRouter();
  const { toast } = useToast();

  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [editingRole, setEditingRole] = useState<Record<string, UserRole | undefined>>({});

  const { defectTypes, addDefectType, isLoading: isLoadingDefects } = useDefectTypes();
  const [newDefectInput, setNewDefectInput] = useState('');

  const { clearAllInspectionRecords } = useInspectionData();
  const [isClearingData, setIsClearingData] = useState(false);

  useEffect(() => {
    if (!authLoading && !currentUser) {
      router.replace('/login');
    } else if (!isRoleLoading && loggedInUserRole !== 'ADMIN') {
      router.replace('/dashboard');
    }
  }, [currentUser, loggedInUserRole, authLoading, isRoleLoading, router]);

  useEffect(() => {
    if (loggedInUserRole === 'ADMIN') {
      setIsLoadingUsers(true);
      const usersQuery = query(collection(db, USERS_COLLECTION), orderBy("createdAt", "desc"));
      const unsubscribe = onSnapshot(usersQuery, (snapshot) => {
        const fetchedUsers = snapshot.docs.map(docSnap => ({
          ...(docSnap.data() as Omit<UserProfile, 'uid'>),
          uid: docSnap.id,
        })) as UserProfile[];
        setUsersList(fetchedUsers);
        setIsLoadingUsers(false);
      }, (error) => {
        console.error("Error fetching users list:", error);
        toast({ title: "Error", description: "Could not fetch users list.", variant: "destructive" });
        setIsLoadingUsers(false);
      });

      return () => unsubscribe();
    }
  }, [loggedInUserRole, toast]);

  const handleUpdateUserStatus = useCallback(async (userId: string, newStatus: UserProfile['status']) => {
    if (loggedInUserRole !== 'ADMIN') {
      toast({ title: "Permission Denied", description: "You are not authorized to perform this action.", variant: "destructive" });
      return;
    }
    const targetUser = usersList.find(u => u && u.uid === userId);
    if (targetUser && (targetUser.role || 'DATA_VIEWER') === 'ADMIN' && currentUser?.uid === userId) {
        const adminCount = usersList.filter(u => u && (u.role || 'DATA_VIEWER') === 'ADMIN' && (u.status || 'pending_approval') === 'active').length;
        if (adminCount <= 1 && (newStatus === 'pending_approval' || newStatus === 'suspended')) {
            toast({ title: "Action Restricted", description: "Cannot suspend or set to pending for the sole active admin.", variant: "destructive" });
            return;
        }
    }

    try {
      const userDocRef = doc(db, USERS_COLLECTION, userId);
      await updateDoc(userDocRef, {
        status: newStatus,
        updatedAt: serverTimestamp(),
      });
      toast({ title: "Status Updated", description: `User status changed to ${newStatus}.`, variant: "default" });
    } catch (error) {
      console.error("Error updating user status:", error);
      toast({ title: "Error", description: "Failed to update user status.", variant: "destructive" });
    }
  }, [loggedInUserRole, usersList, currentUser?.uid, toast]);

  const handleRoleChange = useCallback((userId: string, newRole: UserRole) => {
    setEditingRole(prev => ({ ...prev, [userId]: newRole }));
  }, []);

  const handleUpdateUserRole = useCallback(async (userId: string) => {
    if (loggedInUserRole !== 'ADMIN') {
      toast({ title: "Permission Denied", description: "You are not authorized to perform this action.", variant: "destructive" });
      return;
    }
    const newRole = editingRole[userId];
    if (!newRole) {
      toast({ title: "No Role Selected", description: "Please select a role to update.", variant: "destructive" });
      return;
    }

    const targetUser = usersList.find(u => u && u.uid === userId);
     if (targetUser && (targetUser.role || 'DATA_VIEWER') === 'ADMIN' && newRole !== 'ADMIN' && currentUser?.uid === userId) {
        const adminCount = usersList.filter(u => u && (u.role || 'DATA_VIEWER') === 'ADMIN' && (u.status || 'pending_approval') === 'active').length;
        if (adminCount <= 1) {
            toast({ title: "Action Restricted", description: "Cannot change the role of the sole active admin.", variant: "destructive" });
            setEditingRole(prev => ({ ...prev, [userId]: targetUser.role as UserRole || 'DATA_VIEWER' })); 
            return;
        }
    }

    try {
      const userDocRef = doc(db, USERS_COLLECTION, userId);
      await updateDoc(userDocRef, {
        role: newRole,
        updatedAt: serverTimestamp(),
      });
      toast({ title: "Role Updated", description: `User role changed to ${newRole}.`, variant: "default" });
      setEditingRole(prev => {
        const updated = { ...prev };
        delete updated[userId];
        return updated;
      });
    } catch (error) {
      console.error("Error updating user role:", error);
      toast({ title: "Error", description: "Failed to update user role.", variant: "destructive" });
    }
  }, [loggedInUserRole, editingRole, usersList, currentUser?.uid, toast]);

  const handleAddDefectType = useCallback(async () => {
    if (loggedInUserRole !== 'ADMIN') {
      toast({ title: "Permission Denied", description: "You are not authorized to perform this action.", variant: "destructive" });
      return;
    }
    if (!newDefectInput.trim()) {
      toast({ title: "Input Required", description: "Please enter a defect type name.", variant: "destructive" });
      return;
    }
    const success = await addDefectType(newDefectInput);
    if (success) {
      setNewDefectInput('');
    }
  }, [loggedInUserRole, newDefectInput, addDefectType, toast]);

  const handleClearAllInspectionData = useCallback(async () => {
    if (loggedInUserRole !== 'ADMIN') {
      toast({ title: "Permission Denied", description: "You are not authorized to perform this action.", variant: "destructive" });
      return;
    }
    setIsClearingData(true);
    const result = await clearAllInspectionRecords();
    if (result.success) {
      toast({ title: "Data Cleared", description: result.message, variant: "default" });
    } else {
      toast({ title: "Error Clearing Data", description: result.message, variant: "destructive" });
    }
    setIsClearingData(false);
  }, [loggedInUserRole, clearAllInspectionRecords, toast]);


  if (authLoading || isRoleLoading) {
    return (
      <div className="container mx-auto py-8 flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2">Loading Admin Panel...</p>
      </div>
    );
  }

  if (loggedInUserRole !== 'ADMIN') {
    return (
      <div className="container mx-auto py-8 text-center">
        <ShieldAlert className="h-16 w-16 text-destructive mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-destructive">Access Denied</h1>
        <p className="text-muted-foreground">You do not have permission to view this page.</p>
        <Button onClick={() => router.push('/dashboard')} className="mt-4">Go to Dashboard</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-primary flex items-center">
            <ShieldAlert className="mr-2 h-6 w-6" />
            Administrator Panel
          </CardTitle>
          <CardDescription>Manage users, roles, defect types, and application settings.</CardDescription>
        </CardHeader>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-primary flex items-center"><Users className="mr-2 h-5 w-5"/> User Management</CardTitle>
          <CardDescription>Modify user roles and statuses.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingUsers ? (
            <div className="flex justify-center items-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="ml-2">Loading users...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableCaption>{usersList.length === 0 ? "No users found." : "A list of all registered users."}</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Mobile</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usersList.map((user, index) => {
                    if (!user || !user.uid) {
                      console.warn("AdminPage: Skipping rendering of invalid user data at index:", index, user);
                      return null;
                    }
                    const userCurrentRole = user.role || 'DATA_VIEWER'; 
                    const userCurrentStatus = user.status || 'pending_approval'; 
                    const isCurrentUserTheSoleAdmin = currentUser?.uid === user.uid &&
                                                     userCurrentRole === 'ADMIN' &&
                                                     usersList.filter(u => u && (u.role || 'DATA_VIEWER') === 'ADMIN' && (u.status || 'pending_approval') === 'active').length <= 1;

                    return (
                      <TableRow key={user.uid}>
                        <TableCell className="font-medium">{user.name || 'N/A'}</TableCell>
                        <TableCell>{user.email || 'N/A'}</TableCell>
                        <TableCell>{user.mobile || 'N/A'}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Select
                              value={editingRole[user.uid] || userCurrentRole}
                              onValueChange={(newRoleVal) => handleRoleChange(user.uid, newRoleVal as UserRole)}
                              disabled={isCurrentUserTheSoleAdmin && (editingRole[user.uid] ? editingRole[user.uid] !== 'ADMIN' : true)}
                            >
                              <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Select role" />
                              </SelectTrigger>
                              <SelectContent>
                                {USER_ROLES_LIST.map(roleOpt => (
                                  <SelectItem key={roleOpt} value={roleOpt}>
                                    {roleOpt.replace('_', ' ')}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {editingRole[user.uid] && editingRole[user.uid] !== userCurrentRole && (
                              <Button size="sm" variant="outline" onClick={() => handleUpdateUserRole(user.uid)} title="Save Role Change">
                                <Save className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(userCurrentStatus as UserProfile['status'])}>
                            {(userCurrentStatus as string).replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center space-x-1">
                          {userCurrentStatus === 'pending_approval' && (
                            <Button size="sm" variant="outline" className="text-green-600 border-green-600 hover:bg-green-50 hover:text-green-700" onClick={() => handleUpdateUserStatus(user.uid, 'active')} title="Approve User">
                              <CheckCircle className="mr-1 h-4 w-4" /> Approve
                            </Button>
                          )}
                          {userCurrentStatus === 'active' && (
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="text-orange-600 border-orange-600 hover:bg-orange-50 hover:text-orange-700" 
                              onClick={() => handleUpdateUserStatus(user.uid, 'suspended')} 
                              title={isCurrentUserTheSoleAdmin ? "Cannot suspend sole admin" : "Suspend User"}
                              disabled={isCurrentUserTheSoleAdmin}
                            >
                              <XCircle className="mr-1 h-4 w-4" /> Suspend
                            </Button>
                          )}
                          {userCurrentStatus === 'suspended' && (
                            <Button size="sm" variant="outline" className="text-blue-600 border-blue-600 hover:bg-blue-50 hover:text-blue-700" onClick={() => handleUpdateUserStatus(user.uid, 'active')} title="Reactivate User">
                              <UserCog className="mr-1 h-4 w-4" /> Reactivate
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-primary flex items-center">
            <ListPlus className="mr-2 h-5 w-5" /> Defect Type Management
          </CardTitle>
          <CardDescription>Add and view defect types used in inspection reporting.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label htmlFor="newDefectInput">Add New Defect Type</Label>
            <div className="flex items-center gap-2 mt-1">
              <Input
                id="newDefectInput"
                type="text"
                value={newDefectInput}
                onChange={(e) => setNewDefectInput(e.target.value)}
                placeholder="Enter new defect type"
                className="flex-grow"
              />
              <Button onClick={handleAddDefectType} disabled={isLoadingDefects || !newDefectInput.trim()}>
                {isLoadingDefects && newDefectInput.trim() ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Tag className="mr-2 h-4 w-4" />}
                Add Defect
              </Button>
            </div>
          </div>
          <div>
            <h4 className="text-md font-medium mb-2">Current Defect Types:</h4>
            {isLoadingDefects ? (
              <div className="flex items-center text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading defect types...
              </div>
            ) : defectTypes.length > 0 ? (
              <ScrollArea className="h-48 w-full rounded-md border p-2">
                <ul className="space-y-1">
                  {defectTypes.map((defect, index) => (
                    <li key={index} className="text-sm p-1 bg-secondary/30 rounded-sm">
                      {defect}
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            ) : (
              <p className="text-sm text-muted-foreground">No defect types found. Add some above.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-lg border-destructive">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-destructive flex items-center">
            <AlertTriangleIcon className="mr-2 h-5 w-5" /> Data Management (Danger Zone)
          </CardTitle>
          <CardDescription>Perform irreversible data operations. Use with extreme caution.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-medium text-destructive-foreground">Clear Inspection Records</h4>
            <p className="text-sm text-muted-foreground mb-2">
              This action will permanently delete all inspection records from the database. 
              This cannot be undone.
            </p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={isClearingData}>
                  {isClearingData ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Trash2 className="mr-2 h-4 w-4" />}
                  {isClearingData ? "Clearing Data..." : "Clear All Inspection Records"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action is irreversible. All inspection records will be permanently deleted. 
                    Consider backing up your data before proceeding.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleClearAllInspectionData} 
                    className="bg-destructive hover:bg-destructive/90"
                    disabled={isClearingData}
                  >
                    {isClearingData ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                    Yes, delete all records
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
          {/* Add other data management buttons here if needed, e.g., Reset Monthly Targets */}
        </CardContent>
      </Card>

    </div>
  );
}

