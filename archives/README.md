# 设备档案备份

`anonymous-2026-10-30.json.enc` 是本项目本地 `anonymous.json` 的完整加密快照，采用 AES-256-GCM。归档保留全部原始字段，但不包含解密密钥。

密钥仅存放在创建归档的本机：

```text
.cache/keys/hgduanju-device-profile-2026-10-30.key
```

该文件权限为 `0600`，并由 `.gitignore` 排除。请单独保管和备份；没有密钥无法恢复归档。新部署可让 SDK 自行注册匿名设备，不需要使用此快照。

## 本地恢复

在项目根目录执行以下代码。它恢复到 `.cache/restored-anonymous.json`，不会覆盖正在使用的档案，也不会打印字段值。若目标文件已存在，操作会停止。

```sh
node --input-type=module <<'JS'
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createDecipheriv } from 'node:crypto';

const envelope = JSON.parse(await readFile('archives/anonymous-2026-10-30.json.enc', 'utf8'));
if (envelope.format !== 'hgduanju-device-profile-v1' || envelope.algorithm !== 'aes-256-gcm') {
  throw new Error('Unsupported archive format');
}
const key = Buffer.from((await readFile('.cache/keys/hgduanju-device-profile-2026-10-30.key', 'utf8')).trim(), 'base64');
const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.iv, 'base64'));
decipher.setAAD(Buffer.from(envelope.format));
decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
const restored = Buffer.concat([
  decipher.update(Buffer.from(envelope.ciphertext, 'base64')),
  decipher.final(),
]);
JSON.parse(restored.toString('utf8'));
await mkdir('.cache', { recursive: true, mode: 0o700 });
await writeFile('.cache/restored-anonymous.json', restored, { mode: 0o600, flag: 'wx' });
console.log('Restored to .cache/restored-anonymous.json');
JS
```

创建时已用本机保存的密钥完成解密，并逐字节核对恢复结果与原始档案一致。密钥和明文均未加入 Git。
