
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from '@/hooks/use-toast';
import { AppLogo } from '@/components/AppLogo';
import { UserPlus, KeyRound, Loader2 } from 'lucide-react';
import { USER_ROLES_LIST, type UserRole } from '@/lib/types';

export default function SignupPage() {
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [requestedRole, setRequestedRole] = useState<UserRole>(USER_ROLES_LIST[3]); // Default to DATA_VIEWER
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { signup } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      toast({ title: "Signup Error", description: "Passwords do not match.", variant: "destructive"});
      return;
    }
    setError('');
    setLoading(true);
    try {
      await signup(name, mobile, email, password, requestedRole);
      toast({ title: "Signup Successful", description: "Your account has been created and is pending approval." });
      router.push('/login?signupSuccess=true'); // Redirect to login, maybe show a message
    } catch (err: any) {
      console.error("Signup error:", err);
      setError(err.message || "Failed to create account. Please try again.");
      toast({ title: "Signup Failed", description: err.message || "Please try again.", variant: "destructive"});
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-background to-secondary p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center">
           <div className="flex flex-col items-center justify-center mb-4">
            <AppLogo className="h-16 w-16 text-primary mb-2" />
            <h1 className="text-3xl font-bold text-primary">VINFAST</h1>
            <p className="text-xl font-semibold text-foreground">InspectZen Account Creation</p>
          </div>
          <CardDescription>Create your account to request access.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required disabled={loading} placeholder="Your Full Name"/>
            </div>
             <div className="space-y-2">
              <Label htmlFor="mobile">Mobile Number</Label>
              <Input id="mobile" type="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} required disabled={loading} placeholder="e.g. 1234567890"/>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email-signup">Email</Label>
              <Input id="email-signup" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={loading} placeholder="you@example.com"/>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password-signup">Password</Label>
              <Input id="password-signup" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={loading} placeholder="Minimum 6 characters"/>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input id="confirm-password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required disabled={loading} placeholder="Re-enter your password"/>
            </div>
            <div className="space-y-2">
                <Label htmlFor="requestedRole">Requested Role</Label>
                <Select value={requestedRole} onValueChange={(value) => setRequestedRole(value as UserRole)} disabled={loading}>
                    <SelectTrigger id="requestedRole">
                        <SelectValue placeholder="Select desired role" />
                    </SelectTrigger>
                    <SelectContent>
                        {USER_ROLES_LIST.filter(role => role !== 'ADMIN').map(role => ( // Users cannot request ADMIN role
                            <SelectItem key={role} value={role}>{role.replace('_', ' ')}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" /> }
              Create Account
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col items-center space-y-2">
          <p className="text-sm text-muted-foreground">
            Already have an account?
          </p>
          <Link href="/login" className="text-sm font-medium text-primary hover:underline">
            <KeyRound className="inline mr-1 h-4 w-4" />
            Login Here
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
