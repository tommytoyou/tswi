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
      console.log('[AUTH DEBUG] signIn callback triggered');
      console.log('[AUTH DEBUG] Provider:', account?.provider);
      console.log('[AUTH DEBUG] User email from OAuth:', user.email);
      console.log('[AUTH DEBUG] User email type:', typeof user.email);

      // Credentials provider handles its own validation in authorize()
      if (account?.provider === 'credentials') {
        console.log('[AUTH DEBUG] Credentials provider - allowing sign in');
        return true;
      }

      // Google OAuth validation
      if (account?.provider === 'google') {
        console.log('[AUTH DEBUG] Google OAuth flow started');

        if (!user.email) {
          console.log('[AUTH DEBUG] DENIED: No email provided by Google');
          return false;
        }

        const normalizedEmail = user.email.toLowerCase();
        console.log('[AUTH DEBUG] Normalized email:', normalizedEmail);

        try {
          const db = await getDb();
          const usersCollection = db.collection<User>('users');
          const invitesCollection = db.collection('invites');

          // Check if user exists in users collection (approved beta tester)
          // Use lowercase for case-insensitive email matching
          console.log('[AUTH DEBUG] Querying database for email:', normalizedEmail);
          const existingUser = await usersCollection.findOne({ email: normalizedEmail });

          console.log('[AUTH DEBUG] Database query result:', existingUser ? {
            found: true,
            dbEmail: existingUser.email,
            name: existingUser.name,
            role: existingUser.role,
            company: existingUser.company
          } : { found: false });

          if (!existingUser) {
            // User doesn't exist - check if they have a pending invite
            console.log('[AUTH DEBUG] User not found, checking for pending invite');
            const pendingInvite = await invitesCollection.findOne({
              email: normalizedEmail,
              status: { $in: ['pending', 'sent'] },
              expiresAt: { $gt: new Date() }
            });

            if (pendingInvite) {
              // User has a valid invite - create their account
              console.log('[AUTH DEBUG] Found pending invite, creating user account');
              const now = new Date();

              const newUser = {
                email: normalizedEmail,
                name: pendingInvite.name || user.name || 'User',
                company: pendingInvite.organization || '',
                role: 'user' as const,
                created_at: now,
                last_login: now,
              };

              await usersCollection.insertOne(newUser);

              // Mark invite as accepted
              await invitesCollection.updateOne(
                { _id: pendingInvite._id },
                {
                  $set: {
                    status: 'accepted',
                    acceptedAt: now,
                  }
                }
              );

              console.log('[AUTH DEBUG] SUCCESS: Created user and accepted invite for:', normalizedEmail);
              return true;
            }

            // No user and no valid invite - redirect to access denied
            console.log('[AUTH DEBUG] DENIED: User not found in database and no pending invite, redirecting to /access-denied');
            return '/access-denied';
          }

          // Update last_login timestamp
          console.log('[AUTH DEBUG] User found, updating last_login');
          await usersCollection.updateOne(
            { email: normalizedEmail },
            { $set: { last_login: new Date() } }
          );

          console.log('[AUTH DEBUG] SUCCESS: Allowing Google sign in for:', normalizedEmail);
          return true;
        } catch (error) {
          console.error('[AUTH DEBUG] DENIED: Database error during sign in:', error);
          return false;
        }
      }

      console.log('[AUTH DEBUG] DENIED: Unknown provider or no provider');
      return false;
    },

    async jwt({ token, user, account }) {
      if (account && user) {
        // Fetch user role from database
        try {
          const db = await getDb();
          const usersCollection = db.collection<User>('users');
          const dbUser = await usersCollection.findOne({ email: user.email!.toLowerCase() });

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
