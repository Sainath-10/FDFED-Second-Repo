import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ChatPostDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  body: string;
}
