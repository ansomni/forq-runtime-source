import type { BusinessCode, ProductGroupMap } from './types'

export const productGroups: ProductGroupMap = {
  MX: ['Smartphone', 'Tablet', 'Wearable'],
  VD: ['TV', 'Monitor', 'Signage'],
  DA: ['Refrigerator', 'Washer', 'Air Conditioner'],
}

export const businessLabels: Record<BusinessCode, string> = {
  MX: 'Mobile eXperience',
  VD: 'Visual Display',
  DA: 'Digital Appliances',
}

export const issueToneByStatus = (status: string): 'critical' | 'warning' | 'success' => {
  if (/open/i.test(status)) return 'critical'
  if (/resolve|analysis|action/i.test(status)) return 'warning'
  return 'success'
}
