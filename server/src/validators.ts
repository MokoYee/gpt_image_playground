import { z } from 'zod'

export const UsernameSchema = z.string()
  .trim()
  .min(3, '用户名长度需为 3-20 位')
  .max(20, '用户名长度需为 3-20 位')
  .regex(/^[A-Za-z][A-Za-z0-9_]*$/, '用户名需以字母开头，仅支持字母、数字和下划线')

export const PasswordSchema = z.string()
  .min(8, '密码至少 8 位')
  .max(72, '密码过长')
  .regex(/[A-Za-z]/, '密码需包含字母')
  .regex(/\d/, '密码需包含数字')
  .refine((value) => !/\s/.test(value), '密码不能包含空格')

export const EmailSchema = z.string().trim().email('邮箱格式不正确')

export const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export function toOffset(page: number, pageSize: number): number {
  return (page - 1) * pageSize
}
