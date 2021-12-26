import * as io from '@actions/io';
import * as core from '@actions/core';
import { exec } from '@actions/exec';
import * as manifest from '../utils/manifest';
import { retry } from '../utils/retry';
import * as git from '../utils/git';
import * as fileManager from '../utils/file-manager';
import { userInput } from '../utils/user-input';
import { SanitizedPayloadParams } from '../interface';

export async function onDefault(params: SanitizedPayloadParams) {
  const input = userInput();
  const paths = fileManager.paths(params);

  core.info(`
    -> Paths:
    -> Your app will be hosted in github pages:
    -> "https://{ username }.github.io/{ repository }/{ slug }/{ branch }/{ head_commit }"
    -> This app URL:
    -> @TODO

    -> Example:
    -> "https://sauloxd.github.io/review-apps/storybook/feature-1/c1fcf15"

    -> We'll build your app with the proper PUBLIC_URL
    -> For more info:
    -> https://github.com/facebook/create-react-app/pull/937/files#diff-9b26877ecf8d15b7987c96e5a17502f6
    -> https://www.gatsbyjs.com/docs/path-prefix/
  `);

  core.info(`
    -> Building app
  `);

  core.exportVariable('PUBLIC_URL', `/${paths.byRepo}/${paths.byHeadCommit}`);

  await exec(input.buildCmd);

  core.info(`
    -> Current working branch: ${params.branch.name}"
    -> Will move (and override) the build result on '${input.dist}' to '${paths.byHeadCommit}' in ${input.branch}"
  `);

  await git.stageChanges(input.dist);
  await git.commit(`Persisting dist output for ${input.slug}`);

  await retry(5)(async () => {
    await git.hardReset(input.branch);
    await git.getFilesFromOtherBranch(params.branch.name, input.dist);
    manifest.replaceApp(params);

    core.debug('Copying from input.dist to -> ' + paths.byHeadCommit);
    await exec('ls');
    await exec('git', ['status']);
    core.debug(input.dist + '->' + paths.byHeadCommit);
    await io.cp(input.dist, paths.byHeadCommit, {
      recursive: true,
      force: true,
    });
    core.debug('Finished copying');
    await exec('ls');
    await exec('git', ['status']);

    await git.stageChanges(paths.byHeadCommit, 'index.html', 'manifest.json');
    await git.commit(`Updating app ${paths.byHeadCommit}`);
    await git.push(input.branch);
  });
  core.debug('Return to original state');
  await git.hardReset(params.branch.name);
}
