'use client'

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBold, faItalic, faListUl, faListOl, faQuoteRight, faUndo, faRedo } from '@fortawesome/free-solid-svg-icons';
import { useEffect } from 'react';

export default function EmailEditor({ value, onChange, placeholder }) {
    const editor = useEditor({
        extensions: [StarterKit],
        content: value || '',
        immediatelyRender: false, // <--- A CORREÇÃO ESTÁ AQUI (Desativa renderização no servidor)
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

    if (!editor) return null;

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

            {/* Área de Texto */}
            <div className="flex-grow overflow-y-auto custom-scrollbar bg-white cursor-text" onClick={() => editor.chain().focus().run()}>
                <EditorContent editor={editor} />
            </div>
        </div>
    );
}