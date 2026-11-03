import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { ForbiddenException, HttpException } from '@nestjs/common';
import { ChatService } from '../src/modules/chat/chat.service';

const competition = { id: 'competition-1', createdBy: 'owner', organizers: ['helper'] };
const teams = [
  { id: 'team-a', competitionId: competition.id, status: 'approved', memberUsernames: ['alice', 'lead-a'] },
  { id: 'team-b', competitionId: competition.id, status: 'approved', memberUsernames: ['bob'] },
];
const stored: any[] = [];
const messages = {
  create: (data: any) => data,
  save: async (data: any) => {
    const saved = { ...data, id: `message-${stored.length + 1}`, createdAt: new Date() };
    stored.push(saved);
    return saved;
  },
  find: async ({ where, take }: any) => stored.filter(message => Object.entries(where).every(([key, value]: any) => value === null || value?._type === 'isNull' ? message[key] === null : message[key] === value)).slice(-take).reverse(),
  count: async ({ where }: any) => stored.filter(message => message.competitionId === where.competitionId && message.channel === where.channel && message.authorUsername === where.authorUsername && message.createdAt > where.createdAt.value).length,
};
const service = new ChatService(
  messages as any,
  { findById: async (id: string) => id === competition.id ? competition : null } as any,
  { findByCompetition: async () => teams, findById: async (id: string) => teams.find(team => team.id === id) || null } as any,
);

async function rejects(work: () => Promise<any>, error: any) {
  await assert.rejects(work, error);
}

async function main() {
  const announce = await service.postCompetition(competition.id, 'announcements', 'helper', ' Match starts at 6 ');
  assert.equal(announce.body, 'Match starts at 6');
  assert.equal((await service.listCompetition(competition.id, 'announcements', 'alice')).length, 1);
  await rejects(() => service.postCompetition(competition.id, 'announcements', 'alice', 'fake'), ForbiddenException);
  await rejects(() => service.listCompetition(competition.id, 'general', 'outsider'), ForbiddenException);

  await service.postCompetition(competition.id, 'general', 'owner', 'Welcome');
  for (let i = 0; i < 5; i++) await service.postCompetition(competition.id, 'general', 'alice', `Message ${i}`);
  await assert.rejects(() => service.postCompetition(competition.id, 'general', 'alice', 'Too fast'), (error: any) => error instanceof HttpException && error.getStatus() === 429);
  await service.postCompetition(competition.id, 'general', 'bob', 'Separate limit');
  assert.equal((await service.listCompetition(competition.id, 'general', 'bob')).length, 7);

  await service.postTeam('team-a', 'alice', 'Private hello');
  assert.equal((await service.listTeam('team-a', 'lead-a')).length, 1);
  await rejects(() => service.listTeam('team-a', 'bob'), ForbiddenException);
  await rejects(() => service.postTeam('team-a', 'helper', 'Organizer cannot read this'), ForbiddenException);
  teams[0].memberUsernames = ['lead-a'];
  await rejects(() => service.listTeam('team-a', 'alice'), ForbiddenException);
  await rejects(() => service.postCompetition(competition.id, 'general', 'alice', 'After removal'), ForbiddenException);
  assert.equal((await service.listTeam('team-a', 'lead-a')).length, 1);
  console.log('Chat permissions, privacy, persistence and rate limits passed.');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
