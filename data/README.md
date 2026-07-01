# Agent Server Data Directory

This directory mirrors the NAS host path used by Docker:

```text
/volume1/docker/personal-os-agent/data
```

The container mounts it as:

```text
/data
```

Runtime databases and real secret files must stay out of git.

For Daoliyu, copy:

```text
data/secrets/daoliyu.env.example
```

to:

```text
/volume1/docker/personal-os-agent/data/secrets/daoliyu.env
```

Then fill in the real account values on the NAS.
