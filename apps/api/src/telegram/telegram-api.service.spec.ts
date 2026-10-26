import { Api, InputFile } from 'grammy';
import { TelegramApiService } from './telegram-api.service';

jest.mock('grammy', () => ({ Api: jest.fn(), InputFile: jest.fn() }));

describe('Telegram bot avatar API', () => {
  it('uploads a fresh JPG through the official setMyProfilePhoto method', async () => {
    const setMyProfilePhoto = jest.fn().mockResolvedValue(true);
    jest.mocked(Api).mockImplementation(() => ({ setMyProfilePhoto }) as never);
    const jpeg = Buffer.from('jpeg-image');
    await new TelegramApiService().setProfilePhoto('test-token', jpeg);
    expect(InputFile).toHaveBeenCalledWith(jpeg, 'bot-avatar.jpg');
    expect(setMyProfilePhoto).toHaveBeenCalledWith({ type: 'static', photo: expect.any(InputFile) });
  });
});
