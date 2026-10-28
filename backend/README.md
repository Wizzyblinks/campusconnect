# Backend maintenance

## Rename Ritman University's campus

After setting the backend database connection in the runtime environment, run:

```sh
npm run db:rename-ritman-campus
```

This idempotently renames the existing `Ritman University` campus record from
`Main Campus` to `Green Campus`. It updates the embedded campus in place, keeping
its existing ID and all student references. The script does not reset or seed
the database and stops without changing data if it finds an ambiguous campus
state.
