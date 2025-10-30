import NextAuthNode from '@/libs/next-auth';

export const runtime = 'nodejs';

export const { GET, POST } = NextAuthNode.handlers;
