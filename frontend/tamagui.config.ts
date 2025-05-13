import { config } from '@tamagui/config/v3';
import { createTamagui } from 'tamagui';
import { themes } from './tamagui-theme';

export const tamaguiConfig = createTamagui({
    ...config,
    themes,
});

export default tamaguiConfig;

export type Conf = typeof tamaguiConfig;

declare module 'tamagui' {
  interface TamaguiCustomConfig extends Conf {}
}