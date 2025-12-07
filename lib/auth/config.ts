import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
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
    CredentialsProvider({
      id: 'credentials',
      name: 'Email',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email and password are required');
        }

        try {
          const db = await getDb();
          const usersCollection = db.collection<User>('users');

          // Find user by email
          const user = await usersCollection.findOne({
            email: credentials.email.toLowerCase()
          });

          if (!user) {
            throw new Error('No account found with this email');
          }

          // Check if user has a password set
          if (!user.password_hash) {
            throw new Error('Password not set. Please set a password first or use Google sign-in.');
          }

          // Verify password
          const isValidPassword = await bcrypt.compare(
            credentials.password,
            user.password_hash
          );

          if (!isValidPassword) {
            throw new Error('Invalid password');
          }

          // Update last_login timestamp
          await usersCollection.updateOne(
            { email: credentials.email.toLowerCase() },
            { $set: { last_login: new Date() } }
          );

          // Return user object for session
          return {
            id: user._id?.toString() || '',
            email: user.email,
            name: user.name,
            image: null,
          };
        } catch (error) {
          if (error instanceof Error) {
            throw error;
          }
          throw new Error('Authentication failed');
        }
      },
    }),
  ],
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    async signIn({ user, account }) {
      // Credentials provider handles its own validation in authorize()
      if (account?.provider === 'credentials') {
        return true;
      }

      // Google OAuth validation
      if (account?.provider === 'google') {
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
      }

      return false;
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
