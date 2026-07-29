//frontend/src/api/scoring.js
import request from './index'

export const getScoringRulesAPI = () => request.get('/scoring/rules');
export const batchUpdateRulesAPI = (data) => request.put('/scoring/rules/batch', data);
export const syncScoringColumnsAPI = () => request.post('/scoring/rules/sync-columns');