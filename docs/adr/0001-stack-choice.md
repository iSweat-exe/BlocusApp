# 0001 — Choix de la stack

- **Statut** : Accepted
- **Date** : 2026-10-06
- **Décideurs** : @iSweat-exe

## Contexte

Application mobile-first pour ~1000 utilisateurs (~200 simultanés), équipe de plusieurs développeurs
utilisant des LLMs, budget limité aux offres gratuites de Supabase et Vercel.

## Décision

React + Next.js (App Router, TypeScript) + Tailwind CSS 4 pour le front et le serveur applicatif,
Supabase (Auth, Postgres + RLS, Realtime, Storage) pour le backend, Vercel pour l'hébergement, PWA pour
iOS et Android.

## Conséquences

- Les limites des offres gratuites structurent l'architecture (voir `.dev/constraints.md`) : cache,
  écritures groupées, throttling, une seule connexion Realtime par client.
- Vercel Hobby est réservé à un usage non commercial : passage au plan Pro si l'app est monétisée.
- La sécurité repose sur la RLS : chaque table doit être couverte par des politiques testées.
