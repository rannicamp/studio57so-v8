'use client'

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBold, faItalic, faListUl, faListOl, faQuoteRight, faUndo, faRedo, faLink, faUnlink } from '@fortawesome/free-solid-svg-icons';
import { useEffect, useState, useCallback } from 'react';

export default function EmailEditor({ value, onChange, placeholder }) {
    const [linkModalOpen, setLinkModalOpen] = useState(false);
    const [linkUrl, setLinkUrl] = useState('');

    const editor = useEditor({
        extensions: [
            StarterKit,
            // Extensão de Link: detecta e linkifica URLs automaticamente
            Link.configure({
                openOnClick: false,        // não abre ao clicar (está editando)
                autolink: true,            // detecta URLs enquanto digita/cola
                linkOnPaste: true,         // transforma URLs coladas em links clicáveis
                HTMLAttributes: {
                    class: 'text-blue-600 underline hover:text-blue-800 cursor-pointer',
                    target: '_blank',      // abre em nova aba no e-mail do destinatário
                    rel: 'noopener noreferrer',
                },
            }),
        ],
        content: value || '',
        immediatelyRender: false,
        editorProps: {
            attributes: {
                class: 'prose prose-sm max-w-none focus:outline-none min-h-[200px] p-4 text-gray-800',
            },
        },
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
        },
    });

    // Atualiza o conteúdo se o value mudar externamente (ex: ao carregar template de resposta)
    useEffect(() => {
        if (editor && value && editor.getHTML() !== value) {
             if(editor.isEmpty) {
                 editor.commands.setContent(value);
             }
        }
    }, [value, editor]);

    // Abre o modal de link com a URL atual (se já houver um link selecionado)
    const handleOpenLinkModal = useCallback(() => {
        const currentUrl = editor?.getAttributes('link').href || '';
        setLinkUrl(currentUrl);
        setLinkModalOpen(true);
    }, [editor]);

    // Aplica ou remove o link
    const handleSetLink = useCallback(() => {
        if (!editor) return;

        const url = linkUrl.trim();
        if (!url) {
            // Se URL vazia, remove o link
            editor.chain().focus().extendMarkRange('link').unsetLink().run();
        } else {
            // Adiciona http:// se o usuário esqueceu
            const fullUrl = url.startsWith('http://') || url.startsWith('https://') || url.startsWith('mailto:')
                ? url
                : 'https://' + url;

            editor.chain().focus().extendMarkRange('link').setLink({ href: fullUrl }).run();
        }

        setLinkModalOpen(false);
        setLinkUrl('');
    }, [editor, linkUrl]);

    if (!editor) return null;

    const hasLink = editor.isActive('link');

    const MenuButton = ({ icon, action, isActive, title }) => (
        <button
            type="button"
            onClick={action}
            title={title}
            className={`p-2 rounded hover:bg-gray-200 transition-colors ${isActive ? 'bg-gray-200 text-blue-600' : 'text-gray-600'}`}
        >
            <FontAwesomeIcon icon={icon} className="w-4 h-4" />
        </button>
    );

    return (
        <div className="border border-gray-300 rounded-lg overflow-hidden bg-white flex flex-col h-full">
            {/* Toolbar */}
            <div className="flex items-center gap-1 p-2 border-b bg-gray-50 flex-wrap">
                <MenuButton 
                    icon={faBold} 
                    action={() => editor.chain().focus().toggleBold().run()} 
                    isActive={editor.isActive('bold')} 
                    title="Negrito"
                />
                <MenuButton 
                    icon={faItalic} 
                    action={() => editor.chain().focus().toggleItalic().run()} 
                    isActive={editor.isActive('italic')} 
                    title="Itálico"
                />
                <div className="w-px h-6 bg-gray-300 mx-1" />
                <MenuButton 
                    icon={faListUl} 
                    action={() => editor.chain().focus().toggleBulletList().run()} 
                    isActive={editor.isActive('bulletList')} 
                    title="Lista"
                />
                <MenuButton 
                    icon={faListOl} 
                    action={() => editor.chain().focus().toggleOrderedList().run()} 
                    isActive={editor.isActive('orderedList')} 
                    title="Lista Numerada"
                />
                <MenuButton 
                    icon={faQuoteRight} 
                    action={() => editor.chain().focus().toggleBlockquote().run()} 
                    isActive={editor.isActive('blockquote')} 
                    title="Citação"
                />
                <div className="w-px h-6 bg-gray-300 mx-1" />

                {/* BOTÃO DE LINK — novo! */}
                <MenuButton 
                    icon={faLink} 
                    action={handleOpenLinkModal} 
                    isActive={hasLink}
                    title={hasLink ? "Editar Link" : "Inserir Link"}
                />
                {hasLink && (
                    <MenuButton 
                        icon={faUnlink} 
                        action={() => editor.chain().focus().extendMarkRange('link').unsetLink().run()}
                        title="Remover Link"
                    />
                )}

                <div className="w-px h-6 bg-gray-300 mx-1" />
                <MenuButton 
                    icon={faUndo} 
                    action={() => editor.chain().focus().undo().run()} 
                    title="Desfazer"
                />
                <MenuButton 
                    icon={faRedo} 
                    action={() => editor.chain().focus().redo().run()} 
                    title="Refazer"
                />
            </div>

            {/* Modal de Inserção de Link */}
            {linkModalOpen && (
                <div className="px-3 py-2 border-b bg-blue-50 flex items-center gap-2">
                    <FontAwesomeIcon icon={faLink} className="text-blue-500 text-xs shrink-0" />
                    <input
                        type="url"
                        autoFocus
                        value={linkUrl}
                        onChange={(e) => setLinkUrl(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSetLink();
                            if (e.key === 'Escape') { setLinkModalOpen(false); setLinkUrl(''); }
                        }}
                        placeholder="Cole ou digite o link aqui... (ex: https://...)"
                        className="flex-1 text-sm border border-blue-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                    />
                    <button
                        type="button"
                        onClick={handleSetLink}
                        className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded font-bold hover:bg-blue-700 transition-colors shrink-0"
                    >
                        {linkUrl.trim() ? 'Aplicar' : 'Remover'}
                    </button>
                    <button
                        type="button"
                        onClick={() => { setLinkModalOpen(false); setLinkUrl(''); }}
                        className="text-xs text-gray-500 hover:text-gray-700 px-1 shrink-0"
                    >
                        ✕
                    </button>
                </div>
            )}

            {/* Área de Texto */}
            <div className="flex-grow overflow-y-auto custom-scrollbar bg-white cursor-text" onClick={() => editor.chain().focus().run()}>
                <EditorContent editor={editor} />
            </div>
        </div>
    );
}