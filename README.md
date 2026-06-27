# 長野県議員訪問ガイド

静的HTMLサイトです。Vercelでそのまま配信できます。

## 訪問申告機能

`/api/visits` の Vercel Function と PostgreSQL を使って、グループコード内だけで訪問申告を共有します。

- `DATABASE_URL`: PostgreSQL 接続URL。Production 環境変数に設定してください。
- テーブル `nagano_visit_reports` は API 初回実行時に自動作成されます。
- フロント側ではグループコード、表示名、ピン位置、訪問日時、会話記録、次にやることを入力して、各議員カードの「訪問申告」から記録します。
- 訪問先ごとに、誰が訪問したかをカード・一覧・地図ピンで確認できます。

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
