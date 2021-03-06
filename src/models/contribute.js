import Github from 'github-api';
import yaml from 'js-yaml';
import { parseGithubUrl } from '../utils/github';

export default {

  namespace: 'contribute',

  state: {
    visible: false,
    repo: null,
  },

  effects: {
    *validateRepo({ payload }, { put, call, select }) {
      // https://github.com/dvajs/dva-example-user-dashboard/
      const { user, repo } = parseGithubUrl(payload);
      if (user && repo) {
        const { auth } = yield select();
        const { accessToken } = auth;
        const github = new Github({ token: accessToken });

        // read basic information of repo
        const repos = yield github.getRepo(user, repo);
        const { data } = yield repos.getDetails();

        // parse package.json of repo
        const packageJson = yield repos.getContents('master', 'package.json', true);
        console.log('>> packageJson', packageJson);
        yield put({
          type: 'saveRepo',
          payload: {
            ...data,
            isValidScaffold: packageJson.data.scripts.hasOwnProperty('start'),
            isReact: packageJson.data.dependencies.hasOwnProperty('react'),
            isAngular: packageJson.data.dependencies.hasOwnProperty('angular'),
          },
        });
      }
    },
    *submit({ payload }, { put, select }) {
      const { auth } = yield select();
      const { accessToken } = auth;
      const github = new Github({ token: accessToken });
      // fork scaffold-market repo
      const scaffoldRepo = yield github.getRepo('ant-design', 'scaffold-market');
      const fork = yield scaffoldRepo.fork();
      const user = fork.data.owner.login;
      const repo = fork.data.name;

      const forkedRepo = yield github.getRepo(user, repo);

      const brachName = `scaffold-${payload.name}`;
      // create branch
      yield forkedRepo.createBranch('master', brachName);

      // update list
      yield forkedRepo.writeFile(brachName, `scaffolds/${payload.name}/index.yml`, yaml.safeDump(payload), 'submit new scaffold', {
        encode: 'utf-8',
      });

      // pr
      const pullRequestResult = yield scaffoldRepo.createPullRequest({
        title: `add scaffold ${payload.name} to antd scaffold`,
        head: `${user}:${brachName}`,
        base: 'master',
        body: yaml.safeDump(payload),
      });

      console.log('>> pullRequestResult', pullRequestResult);


      // const master = yield forkedRepo.getBranch('master');
      // const masterSHA = master.data.commit.sha;

      // createTree


    },
  },

  reducers: {
    saveRepo(state, { payload }) {
      return { ...state, repo: payload };
    },
  },

};
