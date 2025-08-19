import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
    try {
        const { username, password } = await request.json();

        if (!username || !password) {
            return NextResponse.json({
                success: false,
                error: 'Username and password are required'
            }, { status: 400 });
        }

        // Create Supabase client
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    get: () => '',
                    set: () => { },
                    remove: () => { }
                }
            }
        );

        // Find user by username
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('username', username)
            .single();

        if (error || !user) {
            return NextResponse.json({
                success: false,
                error: 'Invalid username or password'
            }, { status: 401 });
        }

        // Verify password
        const passwordMatch = await bcrypt.compare(password, user.password_hash);

        if (!passwordMatch) {
            return NextResponse.json({
                success: false,
                error: 'Invalid username or password'
            }, { status: 401 });
        }

        // Return user data (without password hash)
        const { password_hash, ...userData } = user;

        return NextResponse.json({
            success: true,
            user: userData
        });

    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json({
            success: false,
            error: 'Internal server error'
        }, { status: 500 });
    }
}
