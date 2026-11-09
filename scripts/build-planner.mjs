import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const planner = fileURLToPath(new URL('../planner/', import.meta.url));
const version = '1.18.1';
const targets = {
  x64: ['x86_64', '4955a38c2e8c99457458e2471472ccd5ee3c45bd7637a315ce33bccf0dd75d9e'],
  arm64: ['aarch64', 'ea08a64846677f36da7f2e9163c4393dd9a9dee814d13a8fb28fbe7dcbf32f6d'],
};

function build(compiler) {
  const result = spawnSync(compiler, ['build', '--target', 'javascript'], { cwd: planner, stdio: 'inherit' });
  if (result.error?.code === 'ENOENT') return false;
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error('Gleam planner compilation failed.');
  return true;
}

if (!build('gleam')) {
  const target = targets[process.arch];
  if (process.platform !== 'linux' || !target) {
    throw new Error(`Install Gleam ${version} and put it on PATH before building the planner.`);
  }
  const [architecture, expectedHash] = target;
  const asset = `gleam-v${version}-${architecture}-unknown-linux-musl.tar.gz`;
  const url = `https://github.com/gleam-lang/gleam/releases/download/v${version}/${asset}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not download Gleam ${version}: HTTP ${response.status}`);
  const archive = Buffer.from(await response.arrayBuffer());
  if (createHash('sha256').update(archive).digest('hex') !== expectedHash) {
    throw new Error('Gleam compiler archive failed its checksum.');
  }
  const directory = await mkdtemp(join(tmpdir(), 'christian-tutors-gleam-'));
  try {
    const archivePath = join(directory, asset);
    await writeFile(archivePath, archive);
    const extraction = spawnSync('tar', ['-xzf', archivePath, '-C', directory], { stdio: 'inherit' });
    if (extraction.status !== 0 || !build(join(directory, 'gleam'))) throw new Error('Could not unpack the Gleam compiler.');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
