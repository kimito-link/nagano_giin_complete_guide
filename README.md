# 長野県議員訪問ガイド

静的HTMLサイトです。Vercelでそのまま配信できます。

## Vercel Token Deploy

GitHub ActionsからVercelへデプロイするため、GitHub repository secrets に以下を設定します。

- `VERCEL_TOKEN`: VercelのAccount Settingsで作成したToken
- `VERCEL_ORG_ID`: VercelのTeam/User ID
- `VERCEL_PROJECT_ID`: VercelのProject ID

ローカルで初回リンクする場合:

```bash
npx vercel link --token <VERCEL_TOKEN>
```

作成された `.vercel/project.json` の `orgId` と `projectId` を、それぞれGitHub Secretsへ登録してください。`.vercel/` はコミットしません。

本番デプロイは `main` ブランチへのpush、またはGitHub Actionsの手動実行で行われます。
