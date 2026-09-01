export const googleOAuthOptions = (redirectTo: string) => ({
  redirectTo,
  queryParams: {
    prompt: 'select_account',
  },
});
