# Automatic deploys with GitHub Actions

`.github/workflows/deploy.yml` builds the image and deploys it to Cloud Run every
time something is pushed to `main` (i.e. every merged PR). It does the same thing
as `deploy.sh`, minus the one-time bucket creation, and finishes with a health check.
You can also start it by hand from the repo's **Actions** tab → *Deploy to Cloud Run*
→ *Run workflow*.

GitHub signs in to Google Cloud with **Workload Identity Federation**: Google trusts
short-lived tokens that GitHub issues for this repository's `main` branch only, so
there is no service-account key to store or leak.

The steps below are needed **once**. Run them from a machine where `gcloud` is
logged in as a project owner (the same place you run `deploy.sh` today).

---

## 1. Google Cloud: create the deployer identity

Run all of these in the same terminal window: later steps reuse the variables
set here.

Set the variables and the active project:

```zsh
PROJECT_ID="metal-apricot-343704"
PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
REPO="AndreyRainchik/fitness-app"
DEPLOYER="github-deployer@${PROJECT_ID}.iam.gserviceaccount.com"
RUNTIME_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
gcloud config set project "$PROJECT_ID"
```

Enable the APIs the workflow uses (does nothing if they are already on):

```zsh
gcloud services enable iamcredentials.googleapis.com sts.googleapis.com run.googleapis.com artifactregistry.googleapis.com
```

Create the service account the workflow acts as, and let it push images and
deploy Cloud Run services:

```zsh
gcloud iam service-accounts create github-deployer --display-name "GitHub Actions deployer"
gcloud projects add-iam-policy-binding "$PROJECT_ID" --member "serviceAccount:$DEPLOYER" --role "roles/run.admin"
gcloud projects add-iam-policy-binding "$PROJECT_ID" --member "serviceAccount:$DEPLOYER" --role "roles/artifactregistry.writer"
```

Let it deploy a service that runs as the default compute service account:

```zsh
gcloud iam service-accounts add-iam-policy-binding "$RUNTIME_SA" --member "serviceAccount:$DEPLOYER" --role "roles/iam.serviceAccountUser"
```

## 2. Google Cloud: trust GitHub for this repo's `main` branch

Create the identity pool, a provider that only accepts tokens from this
repository's `main` branch, and allow that repository to act as the deployer:

```zsh
gcloud iam workload-identity-pools create github \
  --location global --display-name "GitHub Actions"

gcloud iam workload-identity-pools providers create-oidc fitness-app \
  --location global \
  --workload-identity-pool github \
  --display-name "fitness-app repo" \
  --issuer-uri "https://token.actions.githubusercontent.com" \
  --attribute-mapping "google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
  --attribute-condition "assertion.repository == '${REPO}' && assertion.ref == 'refs/heads/main'"

gcloud iam service-accounts add-iam-policy-binding "$DEPLOYER" \
  --role roles/iam.workloadIdentityUser \
  --member "principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github/attribute.repository/${REPO}"
```

## 3. GitHub: add the settings the workflow reads

From the repo root, in the same terminal as steps 1–2 (it reuses
`$PROJECT_NUMBER` and `$DEPLOYER`). You can also set these in the web UI under
**Settings → Secrets and variables → Actions**.

```zsh
gh variable set GCP_WORKLOAD_IDENTITY_PROVIDER --body "projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github/providers/fitness-app"
gh variable set GCP_DEPLOY_SERVICE_ACCOUNT --body "$DEPLOYER"
```

Store the same `.env.yaml` that `deploy.sh` uses (it stays out of git) as a secret:

```zsh
gh secret set ENV_YAML < .env.yaml
```

## 4. Check the image registry

`deploy.sh` and the workflow push to `gcr.io/metal-apricot-343704/fitness-tracker`.
Google has retired Container Registry; `gcr.io` addresses now work only through an
Artifact Registry `gcr.io` repository. Check that one exists:

```zsh
gcloud artifacts repositories list --location us
```

If a repository named `gcr.io` is listed, you're done. If not, the simplest fix
is to create an Artifact Registry repository and point both `deploy.sh` and the
`IMAGE` line in the workflow at it:

```zsh
gcloud artifacts repositories create fitness-tracker --repository-format docker --location us-central1
```

The image then becomes
`us-central1-docker.pkg.dev/metal-apricot-343704/fitness-tracker/fitness-tracker`,
and the workflow's *Configure Docker* step uses `us-central1-docker.pkg.dev`
instead of `gcr.io`.

## 5. Try it

Run the workflow by hand from the **Actions** tab (on `main`), or merge a PR.
The run summary shows the deployed commit and URL; a failed health check marks
the run red.

---

## Notes

- **Changing environment variables:** update the secret, then re-run the workflow:

  ```zsh
  gh secret set ENV_YAML < .env.yaml
  ```

- **Rollback:** every image is also tagged with its commit SHA. Set `SHA` to the
  commit you want, then redeploy it (env vars and volume settings carry over
  from the current revision):

  ```zsh
  SHA="paste-full-commit-sha-here"
  gcloud run deploy fitness-tracker --image "gcr.io/metal-apricot-343704/fitness-tracker:${SHA}" --region us-central1
  ```
- **Deploy timing:** during a rollout the old and new instances can briefly run at
  the same time, each with its own in-memory copy of the SQLite database, so a
  workout saved in that window could be lost. This was already true of manual
  deploys; merging when nobody is logging a workout avoids it.
- `deploy.sh` still works for manual deploys and for creating the bucket in a new project.
