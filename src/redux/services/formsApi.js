import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';
import { supabase } from '../../lib/supabase';

export const formsApi = createApi({
  reducerPath: 'formsApi',
  baseQuery: fakeBaseQuery(),
  tagTypes: ['Forms'],
  endpoints: (builder) => ({
    getForms: builder.query({
      async queryFn(userId) {
        if (!userId) {
          return { data: [] };
        }

        const { data, error } = await supabase
          .from('forms')
          .select('id, public_id, title, status, form_mode, created_at')
          .eq('owner_id', userId)
          .order('created_at', { ascending: false });

        if (error) {
          return { error: { status: error.code || 'SUPABASE_ERROR', data: error.message } };
        }

        return { data: data || [] };
      },
      providesTags: (result = []) => [
        ...result.map((form) => ({ type: 'Forms', id: form.id })),
        { type: 'Forms', id: 'LIST' },
      ],
    }),
    deleteForm: builder.mutation({
      async queryFn(formId) {
        const { error } = await supabase.from('forms').delete().eq('id', formId);

        if (error) {
          return { error: { status: error.code || 'SUPABASE_ERROR', data: error.message } };
        }

        return { data: { success: true } };
      },
      invalidatesTags: (_result, _error, formId) => [
        { type: 'Forms', id: formId },
        { type: 'Forms', id: 'LIST' },
      ],
    }),
    upsertForm: builder.mutation({
      async queryFn({ editMode, publicId, formData }) {
        const isEdit = Boolean(editMode && publicId);

        const query = isEdit
          ? supabase
              .from('forms')
              .update(formData)
              .eq('public_id', publicId)
              .select('id, public_id, join_code, status')
              .single()
          : supabase
              .from('forms')
              .insert([formData])
              .select('id, public_id, join_code, status')
              .single();

        const { data, error } = await query;

        if (error) {
          return { error: { status: error.code || 'SUPABASE_ERROR', data: error.message } };
        }

        return { data };
      },
      invalidatesTags: (result) => {
        if (!result?.id) {
          return [{ type: 'Forms', id: 'LIST' }];
        }

        return [
          { type: 'Forms', id: result.id },
          { type: 'Forms', id: 'LIST' },
        ];
      },
    }),
  }),
});

export const { useGetFormsQuery, useDeleteFormMutation, useUpsertFormMutation } = formsApi;
