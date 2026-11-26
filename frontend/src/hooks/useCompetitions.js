import { useCallback, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { loadCompetitions } from '../store/competitionsSlice.js';

/**
 * Every competition with its teams, kept in the Redux store (state.competitions)
 * so Home, Competitions and Live now share one copy. Each page that uses it
 * shows the stored list straight away and refreshes it in the background.
 */
export default function useCompetitions() {
  const dispatch = useDispatch();
  const list = useSelector((state) => state.competitions.list);
  const loaded = useSelector((state) => state.competitions.loaded);
  const error = useSelector((state) => state.competitions.error);

  const load = useCallback(() => dispatch(loadCompetitions()), [dispatch]);

  useEffect(() => { load(); }, [load]);
  return { loading: !loaded, error, data: list, reload: load };
}
