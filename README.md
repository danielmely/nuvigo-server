# NuviGo demo

Static interactive demo served by a tiny Node server.

Deploy on Railway: New Project -> Deploy from GitHub repo, then Settings -> Networking -> Generate Domain.

Real posters: in Railway, add a service variable `TMDB_API_KEY` (your TMDB v3 API key). Without it the demo shows colored title tiles.

Ratings and descriptions: add a second Railway variable `OMDB_API_KEY` (free key from omdbapi.com/apikey.aspx) to show the real IMDb and Rotten Tomatoes ratings and a short description on each movie page.
