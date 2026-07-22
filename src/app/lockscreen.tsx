import { zodResolver } from '@hookform/resolvers/zod';
import { type Href, useRouter } from 'expo-router';
import { AlertTriangle, EyeIcon, EyeOffIcon, LockKeyhole } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React, { useState } from 'react';
import type { SubmitHandler } from 'react-hook-form';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Image, Keyboard } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import * as z from 'zod';

import { View } from '@/components/ui';
import { FocusAwareStatusBar } from '@/components/ui';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { FormControl, FormControlError, FormControlErrorIcon, FormControlErrorText, FormControlLabel, FormControlLabelText } from '@/components/ui/form-control';
import { Input, InputField, InputIcon, InputSlot } from '@/components/ui/input';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import colors from '@/constants/colors';
import { useTenantConfig } from '@/hooks/use-tenant-config';
import { useAuth } from '@/lib/auth';
import { logger } from '@/lib/logging';
import useLockscreenStore from '@/stores/lockscreen/store';

const lockscreenFormSchema = z.object({
  password: z
    .string({
      required_error: 'Password is required',
    })
    .min(1, 'Password is required'),
});

type FormType = z.infer<typeof lockscreenFormSchema>;

export default function Lockscreen() {
  const { colorScheme } = useColorScheme();
  const { t } = useTranslation();
  const tenantConfig = useTenantConfig();
  const isBranded = tenantConfig.tenantId !== 'default';
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const { unlock } = useLockscreenStore();
  const { logout, status } = useAuth();
  const authStore = useAuth();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormType>({
    resolver: zodResolver(lockscreenFormSchema),
  });

  const onSubmit: SubmitHandler<FormType> = async (data) => {
    setIsUnlocking(true);
    setError(undefined);

    try {
      logger.info({
        message: 'Attempting to unlock screen',
      });

      // In a real implementation, you would verify the password against stored credentials
      // For now, we'll just check if it matches the user's current session
      // You could also implement a PIN system here

      // Simulate password verification
      // This is a simplified version - in production, you'd verify against encrypted stored password
      await new Promise((resolve) => setTimeout(resolve, 500));

      // For now, we'll just unlock without verification
      // In production, you should verify the password matches
      unlock();
      router.replace('/(app)' as Href);
    } catch (err) {
      logger.error({
        message: 'Failed to unlock screen',
        context: { error: err },
      });
      setError(t('lockscreen.unlock_failed'));
    } finally {
      setIsUnlocking(false);
    }
  };

  const handleLogout = async () => {
    logger.info({
      message: 'User logging out from lockscreen',
    });
    unlock();
    await logout();
    router.replace('/login' as Href);
  };

  const handleState = () => {
    setShowPassword((showState) => !showState);
  };

  const handleKeyPress = () => {
    Keyboard.dismiss();
    handleSubmit(onSubmit)();
  };

  return (
    <>
      <FocusAwareStatusBar />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={10}>
        <View className="flex-1 justify-center bg-white p-4 dark:bg-gray-950">
          <View className="items-center justify-center">
            {isBranded ? (
              <View className="items-center justify-center">
                {tenantConfig.watermarkImageUrl ? <Image style={{ width: 96, height: 96, marginBottom: 12 }} source={{ uri: tenantConfig.watermarkImageUrl }} resizeMode="contain" /> : null}
                <Text className="text-center text-3xl font-bold text-gray-900 dark:text-white">{tenantConfig.displayName}</Text>
                <Text className="text-center text-sm font-medium uppercase tracking-widest text-gray-500 dark:text-gray-400">Dispatch</Text>
              </View>
            ) : (
              <Image style={{ width: '96%' }} source={colorScheme === 'dark' ? require('@assets/images/Resgrid_JustText_White.png') : require('@assets/images/Resgrid_JustText.png')} resizeMode="contain" />
            )}

            {/* Lock Icon */}
            <View className="my-8">
              <View className="items-center justify-center rounded-full bg-primary-100 p-6 dark:bg-primary-900">
                <LockKeyhole size={64} className="text-primary-600" />
              </View>
            </View>

            <Text className="pb-2 text-center text-4xl font-bold">{t('lockscreen.title')}</Text>
            <Text className="mb-6 max-w-xl text-center text-gray-500 dark:text-gray-400">{t('lockscreen.message')}</Text>

            {/* User Info Display */}
            {authStore.isAuthenticated && (
              <View className="mb-6 items-center">
                <View className="mb-2 size-20 items-center justify-center rounded-full bg-primary-600">
                  <Text className="text-2xl font-bold text-white">
                    {/* Show first letter of username or profile name */}
                    {authStore.status === 'signedIn' ? 'U' : '?'}
                  </Text>
                </View>
                <Text className="text-lg font-semibold text-gray-900 dark:text-white">{t('lockscreen.welcome_back')}</Text>
              </View>
            )}
          </View>

          {/* Password Input */}
          <FormControl isInvalid={!!errors.password || !!error} className="w-full">
            <FormControlLabel>
              <FormControlLabelText>{t('lockscreen.password')}</FormControlLabelText>
            </FormControlLabel>
            <Controller
              defaultValue=""
              name="password"
              control={control}
              render={({ field: { onChange, onBlur, value } }) => (
                <Input>
                  <InputField
                    type={showPassword ? 'text' : 'password'}
                    placeholder={t('lockscreen.password_placeholder')}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    onSubmitEditing={handleKeyPress}
                    returnKeyType="done"
                    autoCapitalize="none"
                    autoComplete="off"
                  />
                  <InputSlot onPress={handleState} className="pr-3">
                    <InputIcon as={showPassword ? EyeIcon : EyeOffIcon} />
                  </InputSlot>
                </Input>
              )}
            />
            <FormControlError>
              <FormControlErrorIcon as={AlertTriangle} className="text-red-500" />
              <FormControlErrorText className="text-red-500">{errors?.password?.message || error}</FormControlErrorText>
            </FormControlError>
          </FormControl>

          {/* Unlock Button */}
          {isUnlocking ? (
            <Button className="mt-8 w-full">
              <ButtonSpinner color={colors.light.neutral[400]} />
              <ButtonText className="ml-2 text-sm font-medium">{t('lockscreen.unlocking')}</ButtonText>
            </Button>
          ) : (
            <Button className="mt-8 w-full" variant="solid" action="primary" onPress={handleSubmit(onSubmit)}>
              <ButtonText>{t('lockscreen.unlock_button')}</ButtonText>
            </Button>
          )}

          {/* Logout Link */}
          <View className="mt-6 items-center">
            <Pressable onPress={handleLogout}>
              <Text className="text-primary-600 underline">{t('lockscreen.not_you')}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}
