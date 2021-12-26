import * as fs from 'fs';
import * as core from '@actions/core';
import { App, Manifest, SanitizedPayloadParams } from '../interface';
import { indexPage } from '../template/index-page';
import * as fileManager from './file-manager';
import { userInput } from './user-input';
import { withError } from './log-error';

export const removeApp = withError(async function removeApp(branch: string) {
  const manifest = getManifest();

  delete manifest[branch];

  fs.writeFileSync('manifest.json', JSON.stringify(manifest, null, 2), 'utf-8');
  fs.writeFileSync('index.html', indexPage(manifest), 'utf-8');
});

export const replaceApp = withError(async function replaceApp(
  params: SanitizedPayloadParams
) {
  const manifest = getManifest();
  const input = userInput();
  const apps = manifest[params.branch.name]?.apps || [];
  const index = apps.findIndex((app) => app.name === input.slug);
  const newApp = buildApp(params);

  if (index > -1) {
    apps[index] = newApp;
  } else {
    apps.push(newApp);
  }

  manifest[params.branch.name] = {
    ...manifest[params.branch.name],
    apps,
  };

  fs.writeFileSync('manifest.json', JSON.stringify(manifest, null, 2), 'utf-8');
  fs.writeFileSync('index.html', indexPage(manifest), 'utf-8');
});

function buildApp(params: SanitizedPayloadParams): App {
  const input = userInput();
  const paths = fileManager.paths(params);

  return {
    name: input.slug,
    headCommitId: params.branch.headCommit,
    updatedAt: new Date(),
    href: paths.byHeadCommit,
    pullRequestUrl: params.branch.pullRequest.url,
  };
}

function getManifest(): Manifest {
  const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf-8'));
  core.debug('CALL getManifest');
  core.debug(JSON.stringify(manifest, null, 2));

  return manifest;
}
