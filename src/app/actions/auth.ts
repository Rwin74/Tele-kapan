'use server'

import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { v4 as uuidv4 } from 'uuid'

export async function checkDeviceApproval(userId: string, shopId: string) {
  const supabase = createClient()
  const cookieStore = cookies()
  const DEVICE_COOKIE_NAME = 'tele_kapan_device_id'
  
  let deviceId = cookieStore.get(DEVICE_COOKIE_NAME)?.value

  if (!deviceId) {
    // Generate new device identifier
    deviceId = uuidv4()
    
    // Attempt to insert the device into devices table
    const { error: insertError } = await supabase.from('devices').insert({
      user_id: userId,
      shop_id: shopId,
      device_identifier: deviceId,
      is_approved: false
    })

    if (insertError) {
      console.error('Device insertion error:', insertError)
      return { status: 'error', message: 'Cihaz kaydı yapılamadı.' }
    }

    // Set HTTP-Only Cookie
    cookieStore.set(DEVICE_COOKIE_NAME, deviceId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 365, // 1 year
    })

    return { status: 'pending', message: 'Cihaz onayı bekleniyor.' }
  }

  // Device cookie exists, check approval status
  const { data: device, error: checkError } = await supabase
    .from('devices')
    .select('is_approved')
    .eq('device_identifier', deviceId)
    .single()

  if (checkError || !device) {
    // If device doesn't exist in DB but cookie exists, maybe it was deleted.
    // We should recreate it.
    console.warn('Device not found in DB, re-registering...')
    cookieStore.delete(DEVICE_COOKIE_NAME)
    return await checkDeviceApproval(userId, shopId)
  }

  if (!device.is_approved) {
    return { status: 'pending', message: 'Cihaz onayı bekleniyor.' }
  }

  // Update last_login
  await supabase
    .from('devices')
    .update({ last_login: new Date().toISOString() })
    .eq('device_identifier', deviceId)

  return { status: 'approved' }
}

export async function signOut() {
  const supabase = createClient()
  await supabase.auth.signOut()
}
