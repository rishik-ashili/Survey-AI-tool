import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import bcrypt from 'bcryptjs';

const ADMIN_CODE = 'admin123';

export async function POST(request: NextRequest) {
    try {
        const { username, password, adminCode } = await request.json();

        if (!username || !password) {
            return NextResponse.json({
                success: false,
                error: 'Username and password are required'
            }, { status: 400 });
        }

        if (username.length < 3) {
            return NextResponse.json({
                success: false,
                error: 'Username must be at least 3 characters long'
            }, { status: 400 });
        }

        if (password.length < 6) {
            return NextResponse.json({
                success: false,
                error: 'Password must be at least 6 characters long'
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

        // Check if username already exists
        const { data: existingUser } = await supabase
            .from('users')
            .select('id')
            .eq('username', username)
            .single();

        if (existingUser) {
            return NextResponse.json({
                success: false,
                error: 'Username already exists'
            }, { status: 409 });
        }

        // Hash password
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Determine if user is admin
        const isAdmin = adminCode === ADMIN_CODE;

        // Create user
        const { data: newUser, error } = await supabase
            .from('users')
            .insert({
                username,
                password_hash: passwordHash,
                is_admin: isAdmin
            })
            .select('id, username, is_admin, created_at, updated_at')
            .single();

        if (error) {
            console.error('Signup error:', error);
            return NextResponse.json({
                success: false,
                error: 'Failed to create user account'
            }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            user: newUser
        });

    } catch (error) {
        console.error('Signup error:', error);
        return NextResponse.json({
            success: false,
            error: 'Internal server error'
        }, { status: 500 });
    }
}
