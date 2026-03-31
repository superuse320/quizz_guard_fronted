import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  searchQuery: '',
};

const homeUiSlice = createSlice({
  name: 'homeUi',
  initialState,
  reducers: {
    setHomeSearchQuery(state, action) {
      state.searchQuery = action.payload || '';
    },
    clearHomeSearchQuery(state) {
      state.searchQuery = '';
    },
  },
});

export const { setHomeSearchQuery, clearHomeSearchQuery } = homeUiSlice.actions;
export default homeUiSlice.reducer;
