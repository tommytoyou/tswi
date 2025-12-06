import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { getDb } from '@/lib/db';
import type { User } from '@/lib/types';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      image?: string;
      role: 'user' | 'user_ai' | 'admin';
      company: string;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: 'user' | 'user_ai' | 'admin';
    company: string;
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== 'google') return false;

      try {
        const db = await getDb();
        const usersCollection = db.collection<User>('users');

        // Check if user exists in users collection (approved beta tester)
        const existingUser = await usersCollection.findOne({ email: user.email! });

        if (!existingUser) {
          // User not approved - redirect to access denied
          return '/access-denied';
        }

        // Update last_login timestamp
        await usersCollection.updateOne(
          { email: user.email! },
          { $set: { last_login: new Date() } }
        );

        return true;
      } catch (error) {
        console.error('Error during sign in:', error);
        return false;
      }
    },

    async jwt({ token, user, account }) {
      if (account && user) {
        // Fetch user role from database
        try {
          const db = await getDb();
          const usersCollection = db.collection<User>('users');
          const dbUser = await usersCollection.findOne({ email: user.email! });

          if (dbUser) {
            token.id = dbUser._id?.toString() || '';
            token.role = dbUser.role || 'user';
            token.company = dbUser.company || '';
          }
        } catch (error) {
          console.error('Error fetching user role:', error);
        }
      }
      return token;
    },

    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.company = token.company;
      }
      return session;
    },
  },
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
  },
  secret: process.env.NEXTAUTH_SECRET,
};
