"use client";

import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { LogOut, User, Shield } from 'lucide-react';
import TranslatableText from './translatable-text';
import AuthForm from './auth-form';
import LanguageSelector from './language-selector';

interface ProtectedLayoutProps {
    children: React.ReactNode;
}

export default function ProtectedLayout({ children }: ProtectedLayoutProps) {
    const { user, isLoading, logout, isAdmin } = useAuth();

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (!user) {
        return <AuthForm />;
    }

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <header className="border-b bg-card">
                <div className="container mx-auto px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <h1 className="text-xl font-bold">
                            <TranslatableText>Survey AI Tool</TranslatableText>
                        </h1>
                        {isAdmin && (
                            <div className="flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-md text-sm">
                                <Shield className="h-3 w-3" />
                                <TranslatableText>Admin</TranslatableText>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-4">
                        <LanguageSelector />

                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <User className="h-4 w-4" />
                            <span>{user.username}</span>
                        </div>

                        <Button variant="outline" size="sm" onClick={logout}>
                            <LogOut className="h-4 w-4 mr-2" />
                            <TranslatableText>Logout</TranslatableText>
                        </Button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="container mx-auto px-4 py-6">
                {children}
            </main>
        </div>
    );
}
