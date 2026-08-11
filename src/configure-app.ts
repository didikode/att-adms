import type { INestApplication } from '@nestjs/common';
import express from 'express';

export function configureApp(app: INestApplication): void {
  app.use(express.text({ type: ['text/plain', 'application/octet-stream'] }));
}
