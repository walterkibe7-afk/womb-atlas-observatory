import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Missing email or password");
        }
        
        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string }
        });
        
        if (!user || !user.password) {
          throw new Error("Invalid email or password");
        }
        
        const isPasswordValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        );
        
        if (!isPasswordValid) {
          throw new Error("Invalid email or password");
        }
        
        return user;
      }
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      // 'user' is only passed in the very first login request
      if (user) {
        token.id = user.id;

        // Fetch the user's role and locale from the DB to embed them into the JWT
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email as string },
          select: { role: true, locale: true },
        });
        token.role = dbUser?.role ?? "participant";
        token.locale = dbUser?.locale ?? null;
      } else if (!token.locale) {
        // Locale is set exactly once, after sign-in, via /choose-language — so
        // the JWT minted at sign-in has locale: null. Re-check on every later
        // decode until it's set; once non-null this branch never runs again
        // for this token, since locale is permanent.
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { locale: true },
        });
        token.locale = dbUser?.locale ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.locale = (token.locale as string | null) ?? null;
      }
      return session;
    },
  },
  pages: {
    signIn: "/", // Use our custom login page
  },
  trustHost: true,
});
