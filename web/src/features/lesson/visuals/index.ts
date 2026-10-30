import type { MDXComponents } from 'mdx/types'
import { AnnotatedCode, BadgeList } from './AnnotatedCode'
import { KeyIdea, Note, Pitfall } from './callouts'
import { Arrow, Box, Card, ColumnHead, Figure, Grid, Point, Row, Stack, Track } from './figure'
import { Key, Role, Slot } from './inline'
import { Checklist, CodePair, Verdict } from './verdict'

/** Every visual a lesson.mdx can use without imports. Later tasks add to this object. */
export const lessonVisuals: MDXComponents = {
  Role,
  Key,
  Slot,
  KeyIdea,
  Note,
  Pitfall,
  Verdict,
  Checklist,
  CodePair,
  AnnotatedCode,
  BadgeList,
  Figure,
  Row,
  Stack,
  Grid,
  Box,
  ColumnHead,
  Arrow,
  Card,
  Track,
  Point,
}
