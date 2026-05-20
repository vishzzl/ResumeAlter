import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
    pages: {
        signIn: '/login',
    },
    callbacks: {
        authorized({ auth, request: { nextUrl } }) {
            const isLoggedIn = !!auth?.user;
            const isOnAuthPage = nextUrl.pathname.startsWith('/login') || nextUrl.pathname.startsWith('/register');
            // const isOnPublicPage = nextUrl.pathname === '/' || nextUrl.pathname.startsWith('/static'); // Allow landing page and static assets if needed.
            // For now, let's protect everything except auth pages.
            // Actually, maybe users want to see the landing page without login? 
            // The prompt said "simple multiple user... share only to them". 
            // So probably strict protection is better.

            if (isOnAuthPage) {
                if (isLoggedIn) return Response.redirect(new URL('/', nextUrl));
                return true;
            }
            return isLoggedIn;
        },
        session({ session, token }) {
            if (session.user && token.sub) {
                session.user.id = token.sub;
            }
            if (session.user && token.role) {
                session.user.role = token.role as string;
            }
            return session;
        },
        jwt({ token, user }) {
            if (user) {
                token.role = user.role;
                token.id = user.id;
            }
            return token;
        }
    },
    session: {
        strategy: 'jwt',
    },
    providers: [], // Add providers with an empty array for now
} satisfies NextAuthConfig;
