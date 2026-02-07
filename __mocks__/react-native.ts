export const Platform = {
  select: (obj: Record<string, any>) => obj.default ?? obj.web,
  OS: 'web',
};
