"use client";

import { useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, User, Lock, Shield } from 'lucide-react';
import TranslatableText from './translatable-text';

export default function AuthForm() {
    const { login, signup } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState('login');

    // Form states
    const [loginData, setLoginData] = useState({
        username: '',
        password: ''
    });

    const [signupData, setSignupData] = useState({
        username: '',
        password: '',
        adminCode: ''
    });

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        const result = await login(loginData.username, loginData.password);

        if (!result.success) {
            setError(result.error || 'Login failed');
        }

        setIsLoading(false);
    };

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        const result = await signup(
            signupData.username,
            signupData.password,
            signupData.adminCode || undefined
        );

        if (!result.success) {
            setError(result.error || 'Signup failed');
        }

        setIsLoading(false);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
            <Card className="w-full max-w-md shadow-lg">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl font-bold">
                        <TranslatableText>Survey AI Tool</TranslatableText>
                    </CardTitle>
                    <CardDescription>
                        <TranslatableText>Sign in to access your surveys</TranslatableText>
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="login">
                                <TranslatableText>Login</TranslatableText>
                            </TabsTrigger>
                            <TabsTrigger value="signup">
                                <TranslatableText>Sign Up</TranslatableText>
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="login" className="space-y-4">
                            <form onSubmit={handleLogin} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="login-username">
                                        <TranslatableText>Username</TranslatableText>
                                    </Label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            id="login-username"
                                            type="text"
                                            placeholder="Enter your username"
                                            value={loginData.username}
                                            onChange={(e) => setLoginData(prev => ({ ...prev, username: e.target.value }))}
                                            className="pl-9"
                                            required
                                            disabled={isLoading}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="login-password">
                                        <TranslatableText>Password</TranslatableText>
                                    </Label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            id="login-password"
                                            type="password"
                                            placeholder="Enter your password"
                                            value={loginData.password}
                                            onChange={(e) => setLoginData(prev => ({ ...prev, password: e.target.value }))}
                                            className="pl-9"
                                            required
                                            disabled={isLoading}
                                        />
                                    </div>
                                </div>

                                {error && (
                                    <Alert variant="destructive">
                                        <AlertDescription>{error}</AlertDescription>
                                    </Alert>
                                )}

                                <Button type="submit" className="w-full" disabled={isLoading}>
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            <TranslatableText>Signing in...</TranslatableText>
                                        </>
                                    ) : (
                                        <TranslatableText>Sign In</TranslatableText>
                                    )}
                                </Button>
                            </form>
                        </TabsContent>

                        <TabsContent value="signup" className="space-y-4">
                            <form onSubmit={handleSignup} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="signup-username">
                                        <TranslatableText>Username</TranslatableText>
                                    </Label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            id="signup-username"
                                            type="text"
                                            placeholder="Choose a username"
                                            value={signupData.username}
                                            onChange={(e) => setSignupData(prev => ({ ...prev, username: e.target.value }))}
                                            className="pl-9"
                                            required
                                            disabled={isLoading}
                                            minLength={3}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="signup-password">
                                        <TranslatableText>Password</TranslatableText>
                                    </Label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            id="signup-password"
                                            type="password"
                                            placeholder="Choose a password"
                                            value={signupData.password}
                                            onChange={(e) => setSignupData(prev => ({ ...prev, password: e.target.value }))}
                                            className="pl-9"
                                            required
                                            disabled={isLoading}
                                            minLength={6}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="signup-admin-code">
                                        <TranslatableText>Admin Code</TranslatableText>
                                        <span className="text-sm text-muted-foreground ml-2">
                                            (<TranslatableText>Optional</TranslatableText>)
                                        </span>
                                    </Label>
                                    <div className="relative">
                                        <Shield className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            id="signup-admin-code"
                                            type="password"
                                            placeholder="Enter admin code for full access"
                                            value={signupData.adminCode}
                                            onChange={(e) => setSignupData(prev => ({ ...prev, adminCode: e.target.value }))}
                                            className="pl-9"
                                            disabled={isLoading}
                                        />
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        <TranslatableText>Leave empty for regular user access</TranslatableText>
                                    </p>
                                </div>

                                {error && (
                                    <Alert variant="destructive">
                                        <AlertDescription>{error}</AlertDescription>
                                    </Alert>
                                )}

                                <Button type="submit" className="w-full" disabled={isLoading}>
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            <TranslatableText>Creating account...</TranslatableText>
                                        </>
                                    ) : (
                                        <TranslatableText>Create Account</TranslatableText>
                                    )}
                                </Button>
                            </form>
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    );
}
