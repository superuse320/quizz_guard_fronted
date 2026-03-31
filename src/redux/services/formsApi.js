import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';
import { supabase } from '../../lib/supabase';

const getDisplayRespondent = (submission, profilesMap) => {
  const profileName = submission.respondent_user_id ? profilesMap.get(submission.respondent_user_id) : '';

  if (profileName) return profileName;
  if (submission.respondent_name) return submission.respondent_name;
  if (submission.respondent_email) return submission.respondent_email;
  if (submission.respondent_user_id) return `Usuario ${submission.respondent_user_id.slice(0, 8)}`;

  return 'Anonimo';
};

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
          .select('id, public_id, title, description, status, form_mode, created_at, theme')
          .eq('owner_id', userId)
          .order('created_at', { ascending: false });

        if (error) {
          return { error: { status: error.code || 'SUPABASE_ERROR', data: error.message } };
        }

        const forms = data || [];
        if (forms.length === 0) {
          return { data: [] };
        }

        const formIds = forms.map((form) => form.id);
        const { data: questionsData, error: questionsError } = await supabase
          .from('form_questions')
          .select('id, form_id, title, type, position')
          .in('form_id', formIds)
          .order('position', { ascending: true });

        if (questionsError) {
          return { error: { status: questionsError.code || 'SUPABASE_ERROR', data: questionsError.message } };
        }

        const grouped = new Map();
        (questionsData || []).forEach((question) => {
          const current = grouped.get(question.form_id) || [];
          current.push(question);
          grouped.set(question.form_id, current);
        });

        const previewQuestionsByForm = new Map();
        const previewQuestionIds = [];
        forms.forEach((form) => {
          const preview = (grouped.get(form.id) || []).slice(0, 3);
          previewQuestionsByForm.set(form.id, preview);
          preview.forEach((question) => previewQuestionIds.push(question.id));
        });

        let optionsByQuestion = new Map();
        if (previewQuestionIds.length > 0) {
          const { data: previewOptionsData, error: previewOptionsError } = await supabase
            .from('form_question_options')
            .select('question_id, label, position')
            .in('question_id', previewQuestionIds)
            .order('position', { ascending: true });

          if (previewOptionsError) {
            return { error: { status: previewOptionsError.code || 'SUPABASE_ERROR', data: previewOptionsError.message } };
          }

          optionsByQuestion = new Map();
          (previewOptionsData || []).forEach((option) => {
            const current = optionsByQuestion.get(option.question_id) || [];
            current.push(option.label || '');
            optionsByQuestion.set(option.question_id, current);
          });
        }

        const enrichedForms = forms.map((form) => ({
          ...form,
          previewQuestions: (previewQuestionsByForm.get(form.id) || []).map((question) => ({
            ...question,
            options: optionsByQuestion.get(question.id) || [],
          })),
        }));

        return { data: enrichedForms };
      },
      providesTags: (result = []) => [
        ...result.map((form) => ({ type: 'Forms', id: form.id })),
        { type: 'Forms', id: 'LIST' },
      ],
    }),
    getFormResponsesDashboard: builder.query({
      async queryFn(publicId) {
        if (!publicId) {
          return { error: { status: 'BAD_REQUEST', data: 'publicId es requerido' } };
        }

        const { data: formData, error: formError } = await supabase
          .from('forms')
          .select('id, title, description, form_mode')
          .eq('public_id', publicId)
          .single();

        if (formError || !formData) {
          return { error: { status: formError?.code || 'SUPABASE_ERROR', data: formError?.message || 'No se pudo cargar el formulario.' } };
        }

        if (String(formData.form_mode || '').toLowerCase() === 'quiz') {
          return {
            data: {
              form: formData,
              blockedByQuizMode: true,
              questions: [],
              options: [],
              submissions: [],
              answers: [],
            },
          };
        }

        const { data: questionsData, error: questionsError } = await supabase
          .from('form_questions')
          .select('id, title, type')
          .eq('form_id', formData.id)
          .order('position', { ascending: true });

        if (questionsError) {
          return { error: { status: questionsError.code || 'SUPABASE_ERROR', data: questionsError.message } };
        }

        const questions = questionsData || [];
        const questionIds = questions.map((question) => question.id);

        let options = [];
        if (questionIds.length > 0) {
          const { data: optionsData } = await supabase
            .from('form_question_options')
            .select('id, question_id, label, position')
            .in('question_id', questionIds);
          options = optionsData || [];
        }

        let submissionsData = null;
        let submissionsError = null;
        const submissionsSelectCandidates = [
          'id, respondent_email, respondent_name, respondent_user_id, started_at, submitted_at, created_at, score, max_score, status',
          'id, respondent_email, respondent_name, respondent_user_id, started_at, submitted_at, created_at, status',
          'id, respondent_email, respondent_name, respondent_user_id, started_at, submitted_at, status',
          'id, respondent_email, respondent_user_id, started_at, submitted_at',
        ];

        for (const selectClause of submissionsSelectCandidates) {
          const queryResult = await supabase
            .from('form_submissions')
            .select(selectClause)
            .eq('form_id', formData.id)
            .order('submitted_at', { ascending: false });

          submissionsData = queryResult.data;
          submissionsError = queryResult.error;
          if (!submissionsError) break;
        }

        if (submissionsError) {
          return { error: { status: submissionsError.code || 'SUPABASE_ERROR', data: submissionsError.message } };
        }

        const safeSubmissions = (submissionsData || []).map((submission) => ({
          ...submission,
          respondent_name: submission.respondent_name || null,
          created_at: submission.created_at || null,
          score: submission.score ?? null,
          max_score: submission.max_score ?? null,
          status: submission.status || null,
        }));

        const uniqueUserIds = [...new Set(safeSubmissions.map((s) => s.respondent_user_id).filter(Boolean))];
        let profilesMap = new Map();

        if (uniqueUserIds.length > 0) {
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('id, name')
            .in('id', uniqueUserIds);

          profilesMap = new Map((profilesData || []).map((profile) => [profile.id, profile.name]));
        }

        const submissions = safeSubmissions.map((submission) => {
          const respondentDisplay = getDisplayRespondent(submission, profilesMap);
          const respondentEmailDisplay =
            submission.respondent_email ||
            (String(respondentDisplay || '').includes('@') ? respondentDisplay : null);

          return {
            ...submission,
            respondent_display: respondentDisplay,
            respondent_email_display: respondentEmailDisplay,
          };
        });

        let answers = [];
        if (submissions.length > 0) {
          const submissionIds = submissions.map((submission) => submission.id);
          const { data: answersData } = await supabase
            .from('form_submission_answers')
            .select('submission_id, question_id, answer_value')
            .in('submission_id', submissionIds);
          answers = answersData || [];
        }

        return {
          data: {
            form: formData,
            blockedByQuizMode: false,
            questions,
            options,
            submissions,
            answers,
          },
        };
      },
      providesTags: (_result, _error, publicId) => [{ type: 'Forms', id: `RESPONSES-${publicId}` }],
    }),
    getFormSubmissionDetail: builder.query({
      async queryFn({ publicId, submissionId }) {
        if (!publicId || !submissionId) {
          return { error: { status: 'BAD_REQUEST', data: 'publicId y submissionId son requeridos' } };
        }

        const { data: formData, error: formError } = await supabase
          .from('forms')
          .select('id, title, description, form_mode')
          .eq('public_id', publicId)
          .single();

        if (formError || !formData) {
          return { error: { status: formError?.code || 'SUPABASE_ERROR', data: formError?.message || 'No se pudo cargar el formulario.' } };
        }

        if (String(formData.form_mode || '').toLowerCase() === 'quiz') {
          return {
            data: {
              form: formData,
              blockedByQuizMode: true,
              questions: [],
              options: [],
              answers: [],
              submission: null,
              respondentName: 'Anonimo',
            },
          };
        }

        const { data: questionsData, error: questionsError } = await supabase
          .from('form_questions')
          .select('id, title, type, description')
          .eq('form_id', formData.id)
          .order('position', { ascending: true });

        if (questionsError) {
          return { error: { status: questionsError.code || 'SUPABASE_ERROR', data: questionsError.message } };
        }

        const { data: optionsData, error: optionsError } = await supabase
          .from('form_question_options')
          .select('*');

        if (optionsError) {
          return { error: { status: optionsError.code || 'SUPABASE_ERROR', data: optionsError.message } };
        }

        let submissionData = null;
        let submissionError = null;
        const submissionSelectCandidates = [
          'id, respondent_email, respondent_name, respondent_user_id, started_at, submitted_at, score, max_score',
          'id, respondent_email, respondent_name, respondent_user_id, started_at, submitted_at',
          'id, respondent_email, respondent_user_id, started_at, submitted_at',
        ];

        for (const selectClause of submissionSelectCandidates) {
          const queryResult = await supabase
            .from('form_submissions')
            .select(selectClause)
            .eq('id', submissionId)
            .single();

          submissionData = queryResult.data;
          submissionError = queryResult.error;
          if (!submissionError) break;
        }

        if (submissionError || !submissionData) {
          return { error: { status: submissionError?.code || 'SUPABASE_ERROR', data: submissionError?.message || 'No se encontro el envio seleccionado.' } };
        }

        const normalizedSubmission = {
          ...submissionData,
          respondent_name: submissionData.respondent_name || null,
          score: submissionData.score ?? null,
          max_score: submissionData.max_score ?? null,
        };

        let respondentName = 'Anonimo';
        if (submissionData.respondent_user_id) {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('name')
            .eq('id', submissionData.respondent_user_id)
            .single();

          if (profileData?.name) respondentName = profileData.name;
        }

        if (respondentName === 'Anonimo') {
          respondentName = submissionData.respondent_name || submissionData.respondent_email ||
            (submissionData.respondent_user_id ? `Usuario ${submissionData.respondent_user_id.slice(0, 8)}` : 'Anonimo');
        }

        const { data: answersData, error: answersError } = await supabase
          .from('form_submission_answers')
          .select('question_id, answer_value, is_correct, points_earned')
          .eq('submission_id', submissionId);

        if (answersError) {
          return { error: { status: answersError.code || 'SUPABASE_ERROR', data: answersError.message } };
        }

        return {
          data: {
            form: formData,
            blockedByQuizMode: false,
            questions: questionsData || [],
            options: optionsData || [],
            answers: answersData || [],
            submission: normalizedSubmission,
            respondentName,
          },
        };
      },
      providesTags: (_result, _error, args) => [{ type: 'Forms', id: `SUBMISSION-${args?.submissionId}` }],
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

export const {
  useGetFormsQuery,
  useGetFormResponsesDashboardQuery,
  useGetFormSubmissionDetailQuery,
  useDeleteFormMutation,
  useUpsertFormMutation,
} = formsApi;
