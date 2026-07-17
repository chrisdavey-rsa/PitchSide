/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SportType, Competition, Match } from './types';

export const FOOTBALL_COMPETITIONS: Competition[] = [
  { id: 'f-epl', name: 'English Premier League', sport: SportType.FOOTBALL, nationality: 'England' },
  { id: 'f-championship', name: 'The Championship', sport: SportType.FOOTBALL, nationality: 'England' },
  { id: 'f-spfl', name: 'Scottish Premiership', sport: SportType.FOOTBALL, nationality: 'Scotland' },
  { id: 'f-facup', name: 'FA Cup', sport: SportType.FOOTBALL, nationality: 'England' },
  { id: 'f-eflcup', name: 'League Cup (EFL Cup)', sport: SportType.FOOTBALL, nationality: 'England' },
  { id: 'f-ucl', name: 'UEFA Champions League', sport: SportType.FOOTBALL, nationality: 'Europe' },
  { id: 'f-uel', name: 'UEFA Europa League', sport: SportType.FOOTBALL, nationality: 'Europe' },
  { id: 'f-shield', name: 'Community Shield', sport: SportType.FOOTBALL, nationality: 'England' },
  { id: 'f-worldcup', name: 'FIFA World Cup', sport: SportType.FOOTBALL, nationality: 'International' },
];

export const RUGBY_COMPETITIONS: Competition[] = [
  { id: 'r-nations', name: 'Nations Championship', sport: SportType.RUGBY, nationality: 'International' },
  { id: 'r-sixnations', name: 'Six Nations', sport: SportType.RUGBY, nationality: 'Europe' },
  { id: 'r-championship', name: 'The Rugby Championship', sport: SportType.RUGBY, nationality: 'Southern Hemisphere' },
  { id: 'r-worldcup', name: 'Rugby World Cup', sport: SportType.RUGBY, nationality: 'International' },
  { id: 'r-urc', name: 'URC (United Rugby Championship)', sport: SportType.RUGBY, nationality: 'Multinational' },
  { id: 'r-top14', name: 'Top 14', sport: SportType.RUGBY, nationality: 'France' },
  { id: 'r-heineken', name: 'Heineken Champions Cup', sport: SportType.RUGBY, nationality: 'Europe' },
];

export const ALL_COMPETITIONS = [...FOOTBALL_COMPETITIONS, ...RUGBY_COMPETITIONS];
