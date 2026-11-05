import { describe, expect, it } from 'vitest'
import {
  documentUrl,
  isProductCaptureSearch,
  routeFromPathname,
  templateSlug,
  workspaceViewFromLocation,
  workspaceViewFromSearch,
} from './navigation'

describe('protected workspace routing', () => {
  it('separates Home, design and print preview URLs', () => {
    expect(workspaceViewFromLocation('/app', '')).toEqual({ kind: 'home' })
    expect(workspaceViewFromLocation('/design/new', '')).toEqual({
      kind: 'new',
      surface: 'design',
    })
    expect(workspaceViewFromLocation('/preview/new', '')).toEqual({
      kind: 'new',
      surface: 'preview',
    })
    expect(workspaceViewFromLocation('/design/template-key-42/电价预测周报', '')).toEqual({
      kind: 'template',
      surface: 'design',
      templateKey: 'template-key-42',
      slug: '电价预测周报',
    })
    expect(workspaceViewFromLocation('/preview/template-key-42/%E7%94%B5%E4%BB%B7', '')).toEqual({
      kind: 'template',
      surface: 'preview',
      templateKey: 'template-key-42',
      slug: '电价',
    })
  })

  it('keeps legacy query links as migration inputs', () => {
    expect(workspaceViewFromSearch('?new=blank')).toEqual({ kind: 'new', surface: 'design' })
    expect(workspaceViewFromSearch('?template=42')).toEqual({
      kind: 'legacy-template',
      templateId: 42,
    })
    expect(workspaceViewFromSearch('?template=delivery-note')).toEqual({
      kind: 'invalid-template',
    })
  })

  it('builds canonical readable URLs without trusting the slug as identity', () => {
    expect(templateSlug('  华东区域 / 电价预测（周报）  ')).toBe('华东区域-电价预测-周报')
    expect(documentUrl('design', 'template-key-42', '华东区域 / 电价预测（周报）')).toBe(
      '/design/template-key-42/%E5%8D%8E%E4%B8%9C%E5%8C%BA%E5%9F%9F-%E7%94%B5%E4%BB%B7%E9%A2%84%E6%B5%8B-%E5%91%A8%E6%8A%A5',
    )
    expect(routeFromPathname('/design/template-key-42/report')).toBe('workspace')
    expect(routeFromPathname('/preview/template-key-42/report')).toBe('workspace')
  })

  it('keeps product capture strictly DEV-only and independent from document routing', () => {
    const search = '?capture=product&template=delivery-note'
    expect(isProductCaptureSearch(search, true)).toBe(true)
    expect(isProductCaptureSearch(search, false)).toBe(false)
  })
})
