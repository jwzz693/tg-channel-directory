import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { fileURLToPath } from 'url';
import { logger } from '../src/utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, '../src/data');
const DATA_FILE = path.join(DATA_DIR, 'channels.json');

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

async function fetchFromRawUrl(url, token) {
  logger.info('从原始URL获取数据', { url });
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await axios.get(url, { headers, timeout: 30000 });
  return res.data;
}

async function fetchFromGithubApi(owner, repo, filePath, branch, token) {
  logger.info('从GitHub API获取数据', { owner, repo, filePath, branch });
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${branch || 'main'}`;
  const res = await axios.get(url, { headers, timeout: 30000 });
  if (!res.data || !res.data.content) {
    throw new Error('GitHub API未返回content字段');
  }
  const buff = Buffer.from(res.data.content, 'base64');
  return JSON.parse(buff.toString('utf-8'));
}

function validateData(data) {
  if (!Array.isArray(data)) throw new Error('数据格式错误：期望为数组');
  for (const item of data) {
    if (!item.id || !item.name || !item.category || !item.link) {
      throw new Error(`条目缺少必要字段: ${JSON.stringify(item)}`);
    }
  }
}

async function main() {
  try {
    ensureDir(DATA_DIR);
    const {
      DATA_REPO_URL,
      DATA_REPO_GITHUB_OWNER,
      DATA_REPO_GITHUB_NAME,
      DATA_REPO_FILE_PATH,
      DATA_REPO_BRANCH,
      GITHUB_TOKEN,
    } = process.env;

    let data;
    if (DATA_REPO_URL) {
      data = await fetchFromRawUrl(DATA_REPO_URL, GITHUB_TOKEN);
    } else if (DATA_REPO_GITHUB_OWNER && DATA_REPO_GITHUB_NAME && DATA_REPO_FILE_PATH) {
      data = await fetchFromGithubApi(
        DATA_REPO_GITHUB_OWNER,
        DATA_REPO_GITHUB_NAME,
        DATA_REPO_FILE_PATH,
        DATA_REPO_BRANCH,
        GITHUB_TOKEN
      );
    } else {
      logger.warn('未配置远程数据源，使用本地示例数据');
      const sample = path.resolve(__dirname, '../src/data/channels.json');
      data = JSON.parse(fs.readFileSync(sample, 'utf-8'));
    }

    validateData(data);
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
    logger.info('数据同步完成', { count: data.length, out: DATA_FILE });
  } catch (err) {
    logger.error('数据同步失败', { error: err.message });
    process.exitCode = 1;
  }
}

main();
